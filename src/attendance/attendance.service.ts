import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { UserRole } from '../common/enums/user-role.enum';
import {
  AttendanceStatusDto,
  CreateAttendanceDto,
} from './dto/create-attendance-query.dto';
import { FindGradeAttendanceSummaryQueryDto } from './dto/find-grade-attendance-summary-query.dto';
import { FindHomeroomAttendanceQueryDto } from './dto/find-homeroom-attendance-query.dto';
import { FindStudentAttendanceQueryDto } from './dto/find-my-attendance-query.dto';
import {
  AttendanceAggregatePeriod,
  FindParentAttendanceQueryDto,
} from './dto/find-parent-attendance-query.dto';
import { FindSubjectAttendanceQueryDto } from './dto/find-subject-attendance-query.dto';

type CurrentUserContext = { userId: string; role?: string };
type AttendanceStatusKey = 'present' | 'late' | 'excused' | 'sick' | 'absent';
type StatusCounts = Record<AttendanceStatusKey, number>;
type DailySummaryRow = {
  date: string;
  total: number;
  statuses: StatusCounts;
  attendanceRate: number;
};

const ATTENDANCE_STATUSES: AttendanceStatusKey[] = [
  'present',
  'late',
  'excused',
  'sick',
  'absent',
];

const STUDENT_ATTENDANCE_READ_ROLES = [
  UserRole.student,
  UserRole.parent,
  UserRole.teacher,
  UserRole.principal,
  UserRole.school_admin,
];

// Public-safe user shape — NO email/username (avoids leaking staff/student PII to
// parents and students). Used for every nested user object in read responses.
const USER_SELECT = {
  id: true,
  fullName: true,
  avatarUrl: true,
};

// Minimal actor reference for markedBy/updatedBy.
const USER_REF_SELECT = {
  id: true,
  fullName: true,
};

const ACADEMIC_YEAR_SELECT = {
  id: true,
  label: true,
  semester: true,
  startDate: true,
  endDate: true,
  isActive: true,
};

const CLASSROOM_SELECT = {
  id: true,
  name: true,
  gradeLevel: true,
};

const STUDENT_SELECT = {
  id: true,
  userId: true,
  nisn: true,
  photoUrl: true,
  user: { select: USER_SELECT },
};

const TEACHER_SELECT = {
  id: true,
  userId: true,
  user: { select: USER_SELECT },
};

const SCHEDULE_ENTRY_INCLUDE = {
  subject: { select: { id: true, code: true, name: true } },
  teacher: { select: TEACHER_SELECT },
  room: { select: { id: true, name: true } },
  periodRow: { select: { id: true, label: true, sortOrder: true } },
  schedule: {
    select: {
      classroomId: true,
      academicYearId: true,
      classroom: { select: CLASSROOM_SELECT },
    },
  },
};

// Heavy include — kept only for the POST writer's echo response.
const ATTENDANCE_RECORD_INCLUDE = {
  studentProfile: { select: STUDENT_SELECT },
  classroom: { select: CLASSROOM_SELECT },
  scheduleEntry: {
    select: {
      id: true,
      dayOfWeek: true,
      subject: { select: { id: true, code: true, name: true } },
      teacher: { select: TEACHER_SELECT },
      room: { select: { id: true, name: true } },
      periodRow: { select: { id: true, label: true, sortOrder: true } },
    },
  },
  markedBy: { select: USER_REF_SELECT },
  updatedBy: { select: USER_REF_SELECT },
};

// Lean include for read paths: only what mapMark + the summary builders consume
// (status/date/scalars come for free). No re-embedded student/classroom/academicYear.
const MARK_QUERY_INCLUDE = {
  classroom: { select: { id: true, name: true, gradeLevel: true } },
  scheduleEntry: {
    select: {
      id: true,
      subject: { select: { id: true, code: true, name: true } },
    },
  },
  markedBy: { select: USER_REF_SELECT },
  updatedBy: { select: USER_REF_SELECT },
};

// Aggregation-only include for the grade summary (no actor refs needed).
const GRADE_QUERY_INCLUDE = {
  classroom: { select: { id: true, name: true, gradeLevel: true } },
  scheduleEntry: {
    select: { subject: { select: { id: true, code: true, name: true } } },
  },
};

function emptyStatusCounts(): StatusCounts {
  return {
    present: 0,
    late: 0,
    excused: 0,
    sick: 0,
    absent: 0,
  };
}

function unique(values: string[]) {
  return [...new Set(values)];
}

@Injectable()
export class AttendanceService {
  constructor(private readonly tenantPrisma: PrismaTenantService) {}

  async createAttendance(actor: CurrentUserContext, dto: CreateAttendanceDto) {
    this.requireRole(actor, [UserRole.teacher]);

    const db = this.tenantPrisma.client;
    const attendanceDate = this.toDateOnly(dto.attendanceDate);
    const teacher = await this.getTeacherProfile(actor);

    const classroom = await db.classroom.findFirst({
      where: {
        id: dto.classroomId,
        academicYearId: dto.academicYearId,
        deletedAt: null,
      },
      select: CLASSROOM_SELECT,
    });
    if (!classroom) {
      throw new NotFoundException(
        `Classroom ${dto.classroomId} not found for academic year ${dto.academicYearId}`,
      );
    }

    const scheduleEntry = dto.scheduleEntryId
      ? await db.scheduleEntry.findFirst({
          where: { id: dto.scheduleEntryId, deletedAt: null },
          include: SCHEDULE_ENTRY_INCLUDE,
        })
      : null;

    if (dto.scheduleEntryId && !scheduleEntry) {
      throw new NotFoundException(`Schedule entry ${dto.scheduleEntryId} not found`);
    }

    if (scheduleEntry) {
      if (scheduleEntry.schedule.classroomId !== dto.classroomId) {
        throw new BadRequestException('Schedule entry does not belong to the requested classroom');
      }
      if (scheduleEntry.schedule.academicYearId !== dto.academicYearId) {
        throw new BadRequestException('Schedule entry does not belong to the requested academic year');
      }
    }

    const homeroomAssignment = await db.homeroomAssignment.findFirst({
      where: {
        classroomId: dto.classroomId,
        academicYearId: dto.academicYearId,
        teacherProfileId: teacher.id,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    const isHomeroomTeacher = Boolean(homeroomAssignment);
    const isSubjectTeacher = scheduleEntry?.teacherProfileId === teacher.id;

    if (!isHomeroomTeacher && !isSubjectTeacher) {
      throw new ForbiddenException(
        'Only the active homeroom teacher or assigned subject teacher can create attendance for this class',
      );
    }

    if (!dto.scheduleEntryId && !isHomeroomTeacher) {
      throw new ForbiddenException('Subject teachers must provide scheduleEntryId');
    }

    await this.ensureStudentsInClassroom(
      dto.records.map((record) => record.studentProfileId),
      dto.classroomId,
    );

    const records = await db.$transaction(async (tx) => {
      const saved: any[] = [];

      for (const record of dto.records) {
        const existing = await tx.attendanceRecord.findFirst({
          where: {
            studentProfileId: record.studentProfileId,
            attendanceDate,
            scheduleEntryId: dto.scheduleEntryId ?? null,
          },
          select: { id: true },
        });

        const mutationData = {
          status: record.status as any,
          lateMinutes:
            record.status === AttendanceStatusDto.late
              ? record.lateMinutes ?? 0
              : null,
          notes: record.notes ?? null,
        };

        if (existing) {
          saved.push(
            await tx.attendanceRecord.update({
              where: { id: existing.id },
              data: {
                ...mutationData,
                classroomId: dto.classroomId,
                academicYearId: dto.academicYearId,
                ...(dto.scheduleEntryId ? { scheduleEntryId: dto.scheduleEntryId } : {}),
                updatedByUserId: actor.userId,
                updateReason: dto.updateReason ?? null,
                deletedAt: null,
              },
              include: ATTENDANCE_RECORD_INCLUDE,
            }),
          );
        } else {
          saved.push(
            await tx.attendanceRecord.create({
              data: {
                studentProfileId: record.studentProfileId,
                classroomId: dto.classroomId,
                academicYearId: dto.academicYearId,
                ...(dto.scheduleEntryId ? { scheduleEntryId: dto.scheduleEntryId } : {}),
                attendanceDate,
                ...mutationData,
                markedByUserId: actor.userId,
              },
              include: ATTENDANCE_RECORD_INCLUDE,
            }),
          );
        }
      }

      return saved;
    });

    return {
      count: records.length,
      createdBy: isSubjectTeacher ? 'subject_teacher' : 'homeroom_teacher',
      classroom: this.mapClassroom(classroom),
      academicYearId: dto.academicYearId,
      scheduleEntry: scheduleEntry ? this.mapScheduleEntry(scheduleEntry) : null,
      attendanceDate: this.dateKey(attendanceDate),
      records: records.map((record) => this.mapWrittenRecord(record)),
      summary: this.buildSummary(records),
    };
  }

  async findHomeroomAttendance(
    actor: CurrentUserContext,
    query: FindHomeroomAttendanceQueryDto,
  ) {
    this.requireRole(actor, [UserRole.teacher]);

    const db = this.tenantPrisma.client;
    const teacher = await this.getTeacherProfile(actor);
    const date = this.toDateOnly(query.date);
    const weekStart = query.weekStart
      ? this.toDateOnly(query.weekStart)
      : this.startOfWeek(date);
    const weekEnd = this.addDays(weekStart, 7);

    const assignments = await db.homeroomAssignment.findMany({
      where: {
        teacherProfileId: teacher.id,
        isActive: true,
        deletedAt: null,
        ...(query.classroomId ? { classroomId: query.classroomId } : {}),
        ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      },
      include: {
        classroom: { select: CLASSROOM_SELECT },
        academicYear: { select: ACADEMIC_YEAR_SELECT },
      },
      orderBy: { assignedAt: 'desc' },
    });

    if (!assignments.length) {
      throw new NotFoundException('No active homeroom assignment found for this teacher');
    }

    const classroomIds = assignments.map((assignment) => assignment.classroomId);
    const enrollments = await db.enrollment.findMany({
      where: { classroomId: { in: classroomIds }, status: 'active' },
      include: {
        classroom: { select: CLASSROOM_SELECT },
        studentProfile: { select: STUDENT_SELECT },
      },
      orderBy: { enrolledAt: 'asc' },
    });

    const studentIds = enrollments.map((enrollment) => enrollment.studentProfileId);
    // Homeroom marks ONLY (scheduleEntryId: null) — never conflate subject-period records.
    const [dayRecords, weekRecords] = await Promise.all([
      db.attendanceRecord.findMany({
        where: {
          studentProfileId: { in: studentIds },
          classroomId: { in: classroomIds },
          scheduleEntryId: null,
          attendanceDate: date,
          deletedAt: null,
        },
        include: MARK_QUERY_INCLUDE,
        orderBy: [{ classroom: { name: 'asc' } }, { createdAt: 'asc' }],
      }),
      db.attendanceRecord.findMany({
        where: {
          studentProfileId: { in: studentIds },
          classroomId: { in: classroomIds },
          scheduleEntryId: null,
          attendanceDate: { gte: weekStart, lt: weekEnd },
          deletedAt: null,
        },
        include: MARK_QUERY_INCLUDE,
        orderBy: [{ attendanceDate: 'asc' }, { classroom: { name: 'asc' } }],
      }),
    ]);

    const enrollmentsByClassroom = this.groupEnrollmentsByClassroom(enrollments);

    return {
      teacher,
      filters: {
        classroomId: query.classroomId ?? null,
        academicYearId: query.academicYearId ?? null,
      },
      date: this.dateKey(date),
      week: this.weekWindow(weekStart),
      classrooms: assignments.map((assignment) => ({
        ...this.mapClassroom(assignment.classroom),
        academicYear: this.mapAcademicYear(assignment.academicYear),
        students: this.buildRoster(
          enrollmentsByClassroom.get(assignment.classroomId) ?? [],
          dayRecords.filter((record) => record.classroomId === assignment.classroomId),
        ),
        summary: this.buildSummary(
          dayRecords.filter((record) => record.classroomId === assignment.classroomId),
          { bySubject: false },
        ),
      })),
      summary: this.buildSummary(dayRecords, { bySubject: false }),
      weeklySummary: this.buildWeeklySummary(weekRecords, weekStart),
    };
  }

  async findSubjectAttendance(
    actor: CurrentUserContext,
    query: FindSubjectAttendanceQueryDto,
  ) {
    this.requireRole(actor, [UserRole.teacher]);

    const db = this.tenantPrisma.client;
    const teacher = await this.getTeacherProfile(actor);
    const date = this.toDateOnly(query.date);
    const weekStart = query.weekStart
      ? this.toDateOnly(query.weekStart)
      : this.startOfWeek(date);
    const weekEnd = this.addDays(weekStart, 7);

    const scheduleWhere = {
      deletedAt: null,
      ...(query.classroomId ? { classroomId: query.classroomId } : {}),
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
    };

    const entryWhere = {
      teacherProfileId: teacher.id,
      deletedAt: null,
      ...(query.scheduleEntryId ? { id: query.scheduleEntryId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      schedule: scheduleWhere,
    };

    const scopeEntries = await db.scheduleEntry.findMany({
      where: {
        ...entryWhere,
      },
      include: SCHEDULE_ENTRY_INCLUDE,
      orderBy: [
        { schedule: { classroom: { name: 'asc' } } },
        { dayOfWeek: 'asc' },
        { periodRow: { sortOrder: 'asc' } },
      ],
    });

    const dailyEntries = query.scheduleEntryId
      ? scopeEntries
      : scopeEntries.filter((entry) => entry.dayOfWeek === this.isoWeekday(date));
    const dailyEntryIds = dailyEntries.map((entry) => entry.id);
    const scopeEntryIds = scopeEntries.map((entry) => entry.id);
    const classroomIds = unique(dailyEntries.map((entry) => entry.schedule.classroomId));

    const [enrollments, dayRecords, weekRecords] = await Promise.all([
      classroomIds.length
        ? db.enrollment.findMany({
            where: { classroomId: { in: classroomIds }, status: 'active' },
            include: {
              classroom: { select: CLASSROOM_SELECT },
              studentProfile: { select: STUDENT_SELECT },
            },
            orderBy: { enrolledAt: 'asc' },
          })
        : Promise.resolve([] as any[]),
      dailyEntryIds.length
        ? db.attendanceRecord.findMany({
            where: {
              scheduleEntryId: { in: dailyEntryIds },
              attendanceDate: date,
              deletedAt: null,
            },
            include: MARK_QUERY_INCLUDE,
            orderBy: [{ attendanceDate: 'asc' }, { createdAt: 'asc' }],
          })
        : Promise.resolve([] as any[]),
      scopeEntryIds.length
        ? db.attendanceRecord.findMany({
            where: {
              scheduleEntryId: { in: scopeEntryIds },
              attendanceDate: { gte: weekStart, lt: weekEnd },
              deletedAt: null,
            },
            include: MARK_QUERY_INCLUDE,
            orderBy: [{ attendanceDate: 'asc' }, { createdAt: 'asc' }],
          })
        : Promise.resolve([] as any[]),
    ]);

    const enrollmentsByClassroom = this.groupEnrollmentsByClassroom(enrollments);

    return {
      teacher,
      filters: {
        scheduleEntryId: query.scheduleEntryId ?? null,
        subjectId: query.subjectId ?? null,
        classroomId: query.classroomId ?? null,
        academicYearId: query.academicYearId ?? null,
      },
      date: this.dateKey(date),
      week: this.weekWindow(weekStart),
      entries: dailyEntries.map((entry) => {
        const classroom = entry.schedule?.classroom ?? null;
        return {
          id: entry.id,
          dayOfWeek: entry.dayOfWeek,
          // Surfaced so the client can POST subject attendance (the writer requires
          // academicYearId, which is otherwise only carried on the schedule).
          academicYearId: entry.schedule?.academicYearId ?? null,
          classroom: classroom
            ? { id: classroom.id, name: classroom.name, gradeLevel: classroom.gradeLevel }
            : null,
          subject: entry.subject ?? null,
          room: entry.room ?? null,
          periodRow: entry.periodRow ?? null,
          students: this.buildRoster(
            enrollmentsByClassroom.get(entry.schedule.classroomId) ?? [],
            dayRecords.filter((record) => record.scheduleEntryId === entry.id),
          ),
        };
      }),
      summary: this.buildSummary(dayRecords),
      weeklySummary: this.buildWeeklySummary(weekRecords, weekStart),
    };
  }

  async findGradeSummary(
    actor: CurrentUserContext,
    query: FindGradeAttendanceSummaryQueryDto,
  ) {
    this.requireRole(actor, [UserRole.principal, UserRole.school_admin]);

    const range = this.resolveSummaryRange(query);
    const classroomWhere = {
      ...(query.classroomId ? { id: query.classroomId } : {}),
      ...(query.gradeLevel !== undefined ? { gradeLevel: query.gradeLevel } : {}),
    };

    const records = await this.tenantPrisma.client.attendanceRecord.findMany({
      where: {
        deletedAt: null,
        attendanceDate: { gte: range.start, lt: range.endExclusive },
        ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
        // Always exclude soft-deleted classrooms; merge optional id/grade filters.
        classroom: { deletedAt: null, ...classroomWhere },
      },
      include: GRADE_QUERY_INCLUDE,
      orderBy: [{ classroom: { gradeLevel: 'asc' } }, { attendanceDate: 'asc' }],
    });

    return {
      filters: {
        academicYearId: query.academicYearId ?? null,
        classroomId: query.classroomId ?? null,
        gradeLevel: query.gradeLevel ?? null,
      },
      range: {
        startDate: this.dateKey(range.start),
        endDate: this.dateKey(this.addDays(range.endExclusive, -1)),
      },
      summary: this.buildSummary(records),
      grades: this.buildGradeBuckets(records),
    };
  }

  async findParentAttendance(
    actor: CurrentUserContext,
    query: FindParentAttendanceQueryDto,
  ) {
    this.requireRole(actor, [UserRole.parent]);

    const db = this.tenantPrisma.client;
    const children = await this.getParentChildren(actor.userId, query.studentProfileId);
    const studentIds = children.map((child) => child.id);
    const range = await this.resolveAttendanceRange({
      period: query.period,
      date: query.date,
      month: query.month,
      academicYearId: query.academicYearId,
    });

    const scheduleEntryWhere = {
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
    };

    // Single effective academic-year filter (query wins, else the term's resolved year).
    const effectiveAcademicYearId = query.academicYearId ?? range.academicYearId;

    const records = await db.attendanceRecord.findMany({
      where: {
        studentProfileId: { in: studentIds },
        deletedAt: null,
        attendanceDate: { gte: range.start, lt: range.endExclusive },
        ...(effectiveAcademicYearId ? { academicYearId: effectiveAcademicYearId } : {}),
        ...(Object.keys(scheduleEntryWhere).length > 0
          ? { scheduleEntry: { is: scheduleEntryWhere } }
          : {}),
      },
      include: MARK_QUERY_INCLUDE,
      orderBy: [
        { attendanceDate: 'asc' },
        { classroom: { name: 'asc' } },
        { createdAt: 'asc' },
      ],
    });

    return {
      parent: { userId: actor.userId },
      filters: {
        studentProfileId: query.studentProfileId ?? null,
        subjectId: query.subjectId ?? null,
        academicYearId: effectiveAcademicYearId ?? null,
        period: range.period,
        date: query.date ?? null,
        month: query.month ?? null,
      },
      range: {
        startDate: this.dateKey(range.start),
        endDate: this.dateKey(this.addDays(range.endExclusive, -1)),
      },
      summary: this.buildSummary(records),
      dailySummary: this.buildDailySummary(records, range.start, range.endExclusive),
      // Records live ONLY under each child (no duplicated top-level array).
      children: this.buildStudentAttendanceBuckets(children, records),
    };
  }

  async findStudentAttendance(
    actor: CurrentUserContext,
    studentId: string,
    query: FindStudentAttendanceQueryDto,
  ) {
    this.requireRole(actor, STUDENT_ATTENDANCE_READ_ROLES);

    const student = await this.tenantPrisma.client.studentProfile.findFirst({
      where: {
        OR: [{ id: studentId }, { userId: studentId }],
        status: 'active',
      },
      select: STUDENT_SELECT,
    });

    if (!student) throw new NotFoundException(`Student ${studentId} not found`);
    await this.ensureCanReadStudentAttendance(actor, student.id, student.userId);

    const scheduleEntryWhere = {
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
    };

    const where = {
      studentProfileId: student.id,
      deletedAt: null,
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(Object.keys(scheduleEntryWhere).length > 0
        ? { scheduleEntry: { is: scheduleEntryWhere } }
        : {}),
    };

    const records = await this.tenantPrisma.client.attendanceRecord.findMany({
      where,
      include: MARK_QUERY_INCLUDE,
      orderBy: [{ attendanceDate: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      student: this.mapStudent(student),
      filters: {
        subjectId: query.subjectId ?? null,
        academicYearId: query.academicYearId ?? null,
      },
      summary: this.buildSummary(records),
      records: records.map((record) => this.mapMark(record, { includeContext: true })),
    };
  }

  private async getTeacherProfile(actor: CurrentUserContext) {
    const teacher = await this.tenantPrisma.client.teacherProfile.findFirst({
      where: { userId: actor.userId, status: 'active', deletedAt: null },
      select: TEACHER_SELECT,
    });
    if (!teacher) throw new NotFoundException('Active teacher profile not found for current user');
    return teacher;
  }

  private async getParentChildren(parentUserId: string, studentProfileId?: string) {
    const guardians = await this.tenantPrisma.client.guardian.findMany({
      where: {
        userId: parentUserId,
        ...(studentProfileId ? { studentProfileId } : {}),
        studentProfile: { status: 'active' },
      },
      include: {
        studentProfile: {
          select: {
            ...STUDENT_SELECT,
            enrollments: {
              where: { status: 'active' },
              include: { classroom: { select: CLASSROOM_SELECT } },
              orderBy: { enrolledAt: 'desc' },
            },
          },
        },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    if (!guardians.length) {
      throw new NotFoundException(
        studentProfileId
          ? `Linked student ${studentProfileId} not found for this parent`
          : 'No linked students found for this parent',
      );
    }

    return guardians.map((guardian) => ({
      ...guardian.studentProfile,
      guardian: {
        id: guardian.id,
        name: guardian.name,
        relationship: guardian.relationship,
        isPrimary: guardian.isPrimary,
      },
    }));
  }

  private async ensureStudentsInClassroom(studentProfileIds: string[], classroomId: string) {
    if (!studentProfileIds.length) throw new BadRequestException('At least one student is required');

    const uniqueStudentIds = unique(studentProfileIds);
    if (uniqueStudentIds.length !== studentProfileIds.length) {
      throw new BadRequestException('Duplicate studentProfileId in records');
    }

    const students = await this.tenantPrisma.client.studentProfile.findMany({
      where: {
        id: { in: uniqueStudentIds },
        status: 'active',
        enrollments: { some: { classroomId, status: 'active' } },
      },
      select: { id: true },
    });

    const found = new Set(students.map((student) => student.id));
    const missing = uniqueStudentIds.filter((studentId) => !found.has(studentId));
    if (missing.length) {
      throw new BadRequestException(
        `Students are not active in the requested classroom: ${missing.join(', ')}`,
      );
    }
  }

  private requireRole(actor: CurrentUserContext, roles: UserRole[]) {
    if (!actor?.userId || !roles.includes(actor.role as UserRole)) {
      throw new ForbiddenException('You are not allowed to access this attendance resource');
    }
  }

  private async ensureCanReadStudentAttendance(
    actor: CurrentUserContext,
    studentProfileId: string,
    studentUserId: string,
  ) {
    switch (actor.role) {
      case UserRole.student:
        if (actor.userId === studentUserId) return;
        throw new ForbiddenException('Students can only view their own attendance');

      case UserRole.parent:
        if (await this.parentCanReadStudentAttendance(actor.userId, studentProfileId)) return;
        throw new ForbiddenException('Parents can only view attendance for linked students');

      case UserRole.teacher:
        if (await this.teacherCanReadStudentAttendance(actor.userId, studentProfileId)) return;
        throw new ForbiddenException('Teachers can only view attendance for assigned students');

      case UserRole.principal:
      case UserRole.school_admin:
        return;

      default:
        throw new ForbiddenException('You cannot view this student attendance');
    }
  }

  private async parentCanReadStudentAttendance(parentUserId: string, studentProfileId: string) {
    const guardian = await this.tenantPrisma.client.guardian.findFirst({
      where: { userId: parentUserId, studentProfileId },
      select: { id: true },
    });
    return Boolean(guardian);
  }

  private async teacherCanReadStudentAttendance(teacherUserId: string, studentProfileId: string) {
    const teacher = await this.tenantPrisma.client.teacherProfile.findFirst({
      where: { userId: teacherUserId, status: 'active', deletedAt: null },
      select: { id: true },
    });
    if (!teacher) return false;

    const enrollment = await this.tenantPrisma.client.enrollment.findFirst({
      where: {
        studentProfileId,
        status: 'active',
        classroom: {
          deletedAt: null,
          OR: [
            {
              homeroomAssignments: {
                some: {
                  teacherProfileId: teacher.id,
                  isActive: true,
                  deletedAt: null,
                },
              },
            },
            { classSubjects: { some: { teacherProfileId: teacher.id } } },
            {
              schedules: {
                some: {
                  deletedAt: null,
                  entries: {
                    some: {
                      teacherProfileId: teacher.id,
                      deletedAt: null,
                    },
                  },
                },
              },
            },
          ],
        },
      },
      select: { id: true },
    });

    return Boolean(enrollment);
  }

  // ── Response shaping ──────────────────────────────────────────────────────

  private mapClassroom(classroom: {
    id: string;
    name: string;
    gradeLevel: number;
  }) {
    return {
      id: classroom.id,
      name: classroom.name,
      gradeLevel: classroom.gradeLevel,
    };
  }

  private mapAcademicYear(academicYear: {
    id: string;
    label: string;
    semester: number;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
  }) {
    return {
      id: academicYear.id,
      label: academicYear.label,
      semester: academicYear.semester,
      startDate: this.dateKey(academicYear.startDate),
      endDate: this.dateKey(academicYear.endDate),
      isActive: academicYear.isActive,
    };
  }

  private mapScheduleEntry(entry: any) {
    return {
      id: entry.id,
      dayOfWeek: entry.dayOfWeek ?? null,
      subject: entry.subject ?? null,
      room: entry.room ?? null,
      periodRow: entry.periodRow ?? null,
    };
  }

  private mapWrittenRecord(record: any) {
    return {
      student: this.mapStudent(record.studentProfile),
      attendance: this.mapMark(record),
    };
  }

  /** Flattened, PII-trimmed student card. */
  private mapStudent(profile: {
    id: string;
    userId: string;
    nisn: string | null;
    photoUrl: string | null;
    user?: { fullName?: string | null; avatarUrl?: string | null } | null;
  }) {
    return {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.user?.fullName ?? null,
      nisn: profile.nisn ?? null,
      photoUrl: profile.photoUrl ?? null,
      avatarUrl: profile.user?.avatarUrl ?? null,
    };
  }

  /**
   * Trim a raw attendance row to the fields a client needs.
   * Roster views (homeroom/subject) omit context — classroom/subject/date already
   * live on the row/entry/top level. List views (parent/student) set includeContext
   * so each record is self-describing across days/classrooms/subjects.
   */
  private mapMark(record: any, opts: { includeContext?: boolean } = {}) {
    const mark: Record<string, unknown> = {
      id: record.id,
      status: record.status,
      lateMinutes: record.lateMinutes ?? null,
      notes: record.notes ?? null,
      markedBy: record.markedBy ?? null,
      markedAt: record.createdAt,
      updatedBy: record.updatedBy ?? null,
      updatedAt: record.updatedAt,
      updateReason: record.updateReason ?? null,
    };
    if (opts.includeContext) {
      mark.attendanceDate = this.dateKey(record.attendanceDate);
      mark.scheduleEntryId = record.scheduleEntryId ?? null;
      mark.classroom = record.classroom
        ? this.mapClassroom(record.classroom)
        : null;
      mark.subject = record.scheduleEntry?.subject ?? null;
    }
    return mark;
  }

  /**
   * Per-student roster: one slim student card + their single mark for the day/period
   * (null when unmarked). Keyed by (studentProfileId, classroomId) so a student
   * double-enrolled in two of the teacher's classrooms is partitioned correctly.
   */
  private buildRoster(
    enrollments: Array<{
      classroom: { id: string; name: string; gradeLevel: number };
      studentProfile: {
        id: string;
        userId: string;
        nisn: string | null;
        photoUrl: string | null;
        user?: { fullName?: string | null; avatarUrl?: string | null } | null;
      };
    }>,
    records: Array<{ studentProfileId: string; classroomId: string }>,
  ) {
    const markByKey = new Map<string, any>();
    for (const record of records) {
      const key = `${record.studentProfileId}|${record.classroomId}`;
      if (!markByKey.has(key)) markByKey.set(key, record);
    }

    return enrollments.map((enrollment) => {
      const record = markByKey.get(`${enrollment.studentProfile.id}|${enrollment.classroom.id}`);
      return {
        student: this.mapStudent(enrollment.studentProfile),
        attendance: record ? this.mapMark(record) : null,
      };
    });
  }

  private groupEnrollmentsByClassroom<T extends { classroomId: string }>(
    enrollments: T[],
  ) {
    const grouped = new Map<string, T[]>();
    for (const enrollment of enrollments) {
      const rows = grouped.get(enrollment.classroomId) ?? [];
      rows.push(enrollment);
      grouped.set(enrollment.classroomId, rows);
    }
    return grouped;
  }

  private buildSummary(
    records: Array<{
      status: string;
      scheduleEntry?: {
        subject: { id: string; code: string | null; name: string } | null;
      } | null;
    }>,
    opts: { bySubject?: boolean } = {},
  ) {
    const includeBySubject = opts.bySubject !== false;
    const totals = emptyStatusCounts();
    const bySubject = new Map<
      string,
      {
        subject: { id: string | null; code: string | null; name: string };
        total: number;
        statuses: StatusCounts;
      }
    >();

    for (const record of records) {
      const status = record.status as AttendanceStatusKey;
      if (!ATTENDANCE_STATUSES.includes(status)) continue;

      totals[status] += 1;

      if (!includeBySubject) continue;

      const subject = record.scheduleEntry?.subject ?? {
        id: null,
        code: null,
        name: 'Unscheduled',
      };
      const key = subject.id ?? 'unscheduled';
      const bucket = bySubject.get(key) ?? {
        subject,
        total: 0,
        statuses: emptyStatusCounts(),
      };

      bucket.total += 1;
      bucket.statuses[status] += 1;
      bySubject.set(key, bucket);
    }

    const summary = {
      total: records.length,
      statuses: totals,
      attendanceRate: this.attendanceRate(totals, records.length),
    };

    if (!includeBySubject) return summary;

    return {
      ...summary,
      bySubject: [...bySubject.values()].map((bucket) => ({
        ...bucket,
        attendanceRate: this.attendanceRate(bucket.statuses, bucket.total),
      })),
    };
  }

  private buildWeeklySummary(
    records: Array<{ status: string; attendanceDate: Date }>,
    weekStart: Date,
  ) {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = this.addDays(weekStart, index);
      return {
        date: this.dateKey(date),
        total: 0,
        statuses: emptyStatusCounts(),
        attendanceRate: 0,
      };
    });
    const dayMap = new Map(days.map((day) => [day.date, day]));

    const totals = emptyStatusCounts();
    let total = 0;
    for (const record of records) {
      const status = record.status as AttendanceStatusKey;
      const day = dayMap.get(this.dateKey(record.attendanceDate));
      if (!day || !ATTENDANCE_STATUSES.includes(status)) continue;
      day.total += 1;
      day.statuses[status] += 1;
      totals[status] += 1;
      total += 1;
    }

    for (const day of days) {
      day.attendanceRate = this.attendanceRate(day.statuses, day.total);
    }

    return {
      ...this.weekWindow(weekStart),
      total,
      statuses: totals,
      attendanceRate: this.attendanceRate(totals, total),
      days,
    };
  }

  private buildDailySummary(
    records: Array<{ status: string; attendanceDate: Date }>,
    start: Date,
    endExclusive: Date,
  ) {
    const days: DailySummaryRow[] = [];
    for (let cursor = new Date(start); cursor < endExclusive; cursor = this.addDays(cursor, 1)) {
      days.push({
        date: this.dateKey(cursor),
        total: 0,
        statuses: emptyStatusCounts(),
        attendanceRate: 0,
      });
    }

    const dayMap = new Map(days.map((day) => [day.date, day]));
    for (const record of records) {
      const status = record.status as AttendanceStatusKey;
      const day = dayMap.get(this.dateKey(record.attendanceDate));
      if (!day || !ATTENDANCE_STATUSES.includes(status)) continue;
      day.total += 1;
      day.statuses[status] += 1;
    }

    for (const day of days) {
      day.attendanceRate = this.attendanceRate(day.statuses, day.total);
    }

    return days;
  }

  private buildStudentAttendanceBuckets(
    children: Array<{
      id: string;
      userId: string;
      nisn: string | null;
      photoUrl: string | null;
      user?: { fullName?: string | null; avatarUrl?: string | null } | null;
      enrollments: unknown[];
      guardian: {
        id: string;
        name: string;
        relationship: string | null;
        isPrimary: boolean;
      };
    }>,
    records: Array<{
      studentProfileId: string;
      status: string;
      attendanceDate: Date;
      scheduleEntry?: {
        subject: { id: string; code: string | null; name: string } | null;
      } | null;
    }>,
  ) {
    const recordsByStudent = new Map<string, typeof records>();
    for (const record of records) {
      const studentRecords = recordsByStudent.get(record.studentProfileId) ?? [];
      studentRecords.push(record);
      recordsByStudent.set(record.studentProfileId, studentRecords);
    }

    return children.map((child) => {
      const childRecords = recordsByStudent.get(child.id) ?? [];
      return {
        student: this.mapStudent(child),
        guardian: child.guardian,
        classrooms: (child.enrollments as any[]).map((enrollment) =>
          this.mapClassroom(enrollment.classroom),
        ),
        summary: this.buildSummary(childRecords),
        records: childRecords.map((record) => this.mapMark(record, { includeContext: true })),
      };
    });
  }

  private buildGradeBuckets(
    records: Array<{
      status: string;
      classroom: { id: string; name: string; gradeLevel: number };
    }>,
  ) {
    const grades = new Map<
      number,
      {
        gradeLevel: number;
        total: number;
        statuses: StatusCounts;
        classrooms: Map<
          string,
          { classroom: { id: string; name: string }; total: number; statuses: StatusCounts }
        >;
      }
    >();

    for (const record of records) {
      const status = record.status as AttendanceStatusKey;
      if (!ATTENDANCE_STATUSES.includes(status)) continue;

      const grade = grades.get(record.classroom.gradeLevel) ?? {
        gradeLevel: record.classroom.gradeLevel,
        total: 0,
        statuses: emptyStatusCounts(),
        classrooms: new Map(),
      };
      grade.total += 1;
      grade.statuses[status] += 1;

      const classroom = grade.classrooms.get(record.classroom.id) ?? {
        classroom: { id: record.classroom.id, name: record.classroom.name },
        total: 0,
        statuses: emptyStatusCounts(),
      };
      classroom.total += 1;
      classroom.statuses[status] += 1;
      grade.classrooms.set(record.classroom.id, classroom);
      grades.set(record.classroom.gradeLevel, grade);
    }

    return [...grades.values()]
      .sort((a, b) => a.gradeLevel - b.gradeLevel)
      .map((grade) => ({
        gradeLevel: grade.gradeLevel,
        total: grade.total,
        statuses: grade.statuses,
        attendanceRate: this.attendanceRate(grade.statuses, grade.total),
        classrooms: [...grade.classrooms.values()].map((classroom) => ({
          ...classroom,
          attendanceRate: this.attendanceRate(classroom.statuses, classroom.total),
        })),
      }));
  }

  private resolveSummaryRange(query: FindGradeAttendanceSummaryQueryDto) {
    if (query.startDate || query.endDate) {
      const start = this.toDateOnly(query.startDate ?? query.endDate);
      const end = this.toDateOnly(query.endDate ?? query.startDate);
      if (end < start) throw new BadRequestException('endDate must be after startDate');
      return { start, endExclusive: this.addDays(end, 1) };
    }

    if (query.weekStart) {
      const start = this.toDateOnly(query.weekStart);
      return { start, endExclusive: this.addDays(start, 7) };
    }

    const date = this.toDateOnly(query.date);
    return { start: date, endExclusive: this.addDays(date, 1) };
  }

  private async resolveAttendanceRange(query: {
    period?: AttendanceAggregatePeriod;
    date?: string;
    month?: string;
    academicYearId?: string;
  }) {
    const period = query.period ?? AttendanceAggregatePeriod.daily;

    if (period === AttendanceAggregatePeriod.termly) {
      const academicYear = await this.resolveAcademicYearForTerm(
        query.academicYearId,
        query.date,
      );
      return {
        period,
        start: this.toDateOnly(this.dateKey(academicYear.startDate)),
        endExclusive: this.addDays(this.toDateOnly(this.dateKey(academicYear.endDate)), 1),
        academicYearId: academicYear.id,
      };
    }

    if (period === AttendanceAggregatePeriod.monthly) {
      const start = query.month
        ? this.monthStart(query.month)
        : this.monthStart(this.dateKey(this.toDateOnly(query.date)).slice(0, 7));
      return {
        period,
        start,
        endExclusive: this.addMonths(start, 1),
        academicYearId: query.academicYearId,
      };
    }

    const date = this.toDateOnly(query.date);
    if (period === AttendanceAggregatePeriod.weekly) {
      const start = this.startOfWeek(date);
      return {
        period,
        start,
        endExclusive: this.addDays(start, 7),
        academicYearId: query.academicYearId,
      };
    }

    return {
      period,
      start: date,
      endExclusive: this.addDays(date, 1),
      academicYearId: query.academicYearId,
    };
  }

  private async resolveAcademicYearForTerm(academicYearId?: string, dateValue?: string) {
    const db = this.tenantPrisma.client;
    if (academicYearId) {
      const academicYear = await db.academicYear.findFirst({
        where: { id: academicYearId },
        select: ACADEMIC_YEAR_SELECT,
      });
      if (!academicYear) throw new NotFoundException(`Academic year ${academicYearId} not found`);
      return academicYear;
    }

    const date = this.toDateOnly(dateValue);
    const containingDate = await db.academicYear.findFirst({
      where: {
        startDate: { lte: date },
        endDate: { gte: date },
      },
      select: ACADEMIC_YEAR_SELECT,
      orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
    });
    if (containingDate) return containingDate;

    const active = await db.academicYear.findFirst({
      where: { isActive: true },
      select: ACADEMIC_YEAR_SELECT,
      orderBy: { startDate: 'desc' },
    });
    if (!active) {
      throw new BadRequestException('No active academic year found for termly attendance summary');
    }
    return active;
  }

  private attendanceRate(statuses: StatusCounts, total: number) {
    if (total === 0) return 0;
    const attended = statuses.present + statuses.late;
    return Math.round((attended / total) * 10000) / 100;
  }

  private toDateOnly(value?: string) {
    const source = value ?? new Date().toISOString().slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(source);
    if (!match) throw new BadRequestException(`Invalid date: ${source}`);

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException(`Invalid date: ${source}`);
    }
    return date;
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private addMonths(date: Date, months: number) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  }

  private monthStart(month: string) {
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (!match) throw new BadRequestException(`Invalid month: ${month}`);
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const date = new Date(Date.UTC(year, monthIndex, 1));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== monthIndex) {
      throw new BadRequestException(`Invalid month: ${month}`);
    }
    return date;
  }

  private startOfWeek(date: Date) {
    const isoDay = this.isoWeekday(date);
    return this.addDays(date, 1 - isoDay);
  }

  private isoWeekday(date: Date) {
    return date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  }

  private weekWindow(weekStart: Date) {
    return {
      startDate: this.dateKey(weekStart),
      endDate: this.dateKey(this.addDays(weekStart, 6)),
    };
  }

  private dateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }
}

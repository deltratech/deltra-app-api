import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CreateScheduleEntryDto } from './dto/create-schedule-entry.dto';
import { UpdateScheduleEntryDto } from './dto/update-schedule-entry.dto';
import { CreatePeriodTemplateDto } from './dto/create-period-template.dto';
import { UpdatePeriodTemplateDto } from './dto/update-period-template.dto';
import { CreatePeriodRowDto } from './dto/create-period-row.dto';
import { UpdatePeriodRowDto } from './dto/update-period-row.dto';
import { ScheduleStatus } from '../common/enums/schedule-status.enum';
import { paginatedResult } from '../common/utils/paginate';
import { NotificationsService } from '../notifications/notifications.service';
import { getTenantContext } from '../tenant/tenant.context';
import { NotificationCategory, NotificationPriority, NotificationSourceType } from '../common/enums/notification.enum';
import { UserRole } from '../common/enums/user-role.enum';

type CurrentUserContext = { userId: string; role?: string };

const ENTRY_INCLUDE = {
  subject: { select: { id: true, code: true, name: true } },
  teacher: { select: { id: true, nuptk: true, user: { select: { id: true, fullName: true } } } },
  room: { select: { id: true, name: true, capacity: true } },
  periodRow: true,
};

const ACADEMIC_YEAR_SELECT = {
  id: true,
  label: true,
  semester: true,
  startDate: true,
  endDate: true,
  isActive: true,
};

const SCHEDULE_INCLUDE = {
  academicYear: { select: ACADEMIC_YEAR_SELECT },
  // The schedule already carries `academicYear` (same year by @@unique[classroomId, academicYearId]),
  // so the classroom doesn't re-embed it.
  classroom: {
    select: {
      id: true,
      name: true,
      gradeLevel: true,
    },
  },
  entries: {
    where: { deletedAt: null },
    include: ENTRY_INCLUDE,
    orderBy: [{ dayOfWeek: 'asc' as const }, { periodRow: { sortOrder: 'asc' as const } }],
  },
};

const DEFAULT_ACTIVE_DAYS = [1, 2, 3, 4, 5];
const PUBLISHED_STATUS = 'published';
const ARCHIVED_STATUS = 'archived';

const SCHEDULE_STUDENT_SELECT = {
  id: true,
  userId: true,
  nisn: true,
  photoUrl: true,
  user: { select: { id: true, fullName: true, avatarUrl: true } },
};

@Injectable()
export class SchedulesService {
  constructor(
    private readonly tenantPrisma: PrismaTenantService,
    private readonly notifications: NotificationsService,
  ) {}

  private isUniqueConstraintError(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002';
  }

  async findAll(filters: {
    classroomId?: string;
    academicYearId?: string;
    status?: ScheduleStatus;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const { classroomId, academicYearId, status, page = 1, limit = 20, search } = filters;
    const skip = (page - 1) * limit;
    const where = {
      deletedAt: null,
      ...(classroomId ? { classroomId } : {}),
      ...(academicYearId ? { academicYearId } : {}),
      ...(status ? { status } : {}),
      ...(search ? { classroom: { name: { contains: search, mode: 'insensitive' as const } } } : {}),
    };

    const [data, total] = await Promise.all([
      this.tenantPrisma.client.schedule.findMany({
        where,
        include: SCHEDULE_INCLUDE,
        skip,
        take: limit,
        orderBy: [{ academicYear: { label: 'desc' as const } }, { academicYear: { semester: 'desc' as const } }, { createdAt: 'desc' }],
      }),
      this.tenantPrisma.client.schedule.count({ where }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const schedule = await this.tenantPrisma.client.schedule.findFirst({
      where: { id, deletedAt: null },
      include: SCHEDULE_INCLUDE,
    });
    if (!schedule) throw new NotFoundException(`Schedule ${id} not found`);
    return schedule;
  }

  async findByClass(classroomId: string, academicYearId?: string) {
    return this.tenantPrisma.client.schedule.findMany({
      where: {
        classroomId,
        deletedAt: null,
        status: { not: 'archived' },
        ...(academicYearId ? { academicYearId } : {}),
      },
      include: SCHEDULE_INCLUDE,
      orderBy: [{ academicYear: { label: 'desc' as const } }, { academicYear: { semester: 'desc' as const } }],
    });
  }

  async findByTeacher(teacherProfileId: string, academicYearId?: string) {
    return this.tenantPrisma.client.schedule.findMany({
      where: {
        deletedAt: null,
        status: { not: 'archived' },
        ...(academicYearId ? { academicYearId } : {}),
        entries: { some: { teacherProfileId, deletedAt: null } },
      },
      include: SCHEDULE_INCLUDE,
      orderBy: [{ academicYear: { label: 'desc' as const } }, { academicYear: { semester: 'desc' as const } }],
    });
  }

  async findByStudent(studentProfileId: string, academicYearId?: string) {
    const enrollments = await this.tenantPrisma.client.enrollment.findMany({
      where: {
        studentProfileId,
        status: 'active',
        ...(academicYearId ? { classroom: { academicYearId } } : {}),
      },
      select: { classroomId: true },
    });

    const classroomIds = enrollments.map((e) => e.classroomId);
    if (!classroomIds.length) return [];

    return this.tenantPrisma.client.schedule.findMany({
      where: {
        classroomId: { in: classroomIds },
        deletedAt: null,
        status: { not: 'archived' },
        ...(academicYearId ? { academicYearId } : {}),
      },
      include: SCHEDULE_INCLUDE,
      orderBy: [{ academicYear: { label: 'desc' as const } }, { academicYear: { semester: 'desc' as const } }],
    });
  }

  async findForCurrentStudent(actor: CurrentUserContext, academicYearId?: string) {
    this.requireRole(actor, [UserRole.student]);

    const student = await this.tenantPrisma.client.studentProfile.findFirst({
      where: { userId: actor.userId, status: 'active' },
      select: SCHEDULE_STUDENT_SELECT,
    });
    if (!student) throw new NotFoundException('Active student profile not found for current user');

    const effectiveAcademicYearId = await this.resolveAcademicYearId(academicYearId);
    const schedules = await this.findPublishedStudentSchedules(student.id, effectiveAcademicYearId);

    return {
      student: this.mapStudent(student),
      filters: { academicYearId: effectiveAcademicYearId ?? null },
      schedules,
    };
  }

  async findForParent(
    actor: CurrentUserContext,
    filters: { studentProfileId?: string; academicYearId?: string },
  ) {
    this.requireRole(actor, [UserRole.parent]);

    const effectiveAcademicYearId = await this.resolveAcademicYearId(filters.academicYearId);
    const guardians = await this.tenantPrisma.client.guardian.findMany({
      where: {
        userId: actor.userId,
        ...(filters.studentProfileId ? { studentProfileId: filters.studentProfileId } : {}),
        studentProfile: { status: 'active' },
      },
      include: {
        studentProfile: {
          select: SCHEDULE_STUDENT_SELECT,
        },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    if (!guardians.length) {
      throw new NotFoundException(
        filters.studentProfileId
          ? `Linked student ${filters.studentProfileId} not found for this parent`
          : 'No linked students found for this parent',
      );
    }

    const children = await Promise.all(
      guardians.map(async (guardian) => ({
        student: this.mapStudent(guardian.studentProfile),
        guardian: {
          id: guardian.id,
          name: guardian.name,
          relationship: guardian.relationship,
          isPrimary: guardian.isPrimary,
        },
        schedules: await this.findPublishedStudentSchedules(guardian.studentProfile.id, effectiveAcademicYearId),
      })),
    );

    return {
      parent: { userId: actor.userId },
      filters: {
        studentProfileId: filters.studentProfileId ?? null,
        academicYearId: effectiveAcademicYearId ?? null,
      },
      children,
    };
  }

  async create(dto: CreateScheduleDto) {
    await this.ensureClassroom(dto.classroomId);
    return this.tenantPrisma.client.schedule.create({
      data: {
        classroomId: dto.classroomId,
        academicYearId: dto.academicYearId,
        status: dto.status,
        copiedFromScheduleId: dto.copiedFromScheduleId,
      },
      include: SCHEDULE_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateScheduleDto) {
    const existing = await this.findOne(id);
    if (dto.classroomId) await this.ensureClassroom(dto.classroomId);

    const schedule = await this.tenantPrisma.client.schedule.update({
      where: { id },
      data: {
        classroomId: dto.classroomId,
        academicYearId: dto.academicYearId,
        status: dto.status,
        publishedAt:
          String(dto.status) === PUBLISHED_STATUS && String(existing.status) !== PUBLISHED_STATUS ? new Date() : undefined,
        archivedAt:
          String(dto.status) === ARCHIVED_STATUS && String(existing.status) !== ARCHIVED_STATUS ? new Date() : undefined,
        copiedFromScheduleId: dto.copiedFromScheduleId,
      },
      include: SCHEDULE_INCLUDE,
    });
    if (String(dto.status) === PUBLISHED_STATUS && String(existing.status) !== PUBLISHED_STATUS) {
      await this.notifySchedulePublished(schedule);
    }
    return schedule;
  }

  async publish(id: string) {
    const existing = await this.findOne(id);
    const schedule = await this.tenantPrisma.client.schedule.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date() },
      include: SCHEDULE_INCLUDE,
    });
    if (String(existing.status) !== PUBLISHED_STATUS) await this.notifySchedulePublished(schedule);
    return schedule;
  }

  async archive(id: string) {
    await this.findOne(id);
    return this.tenantPrisma.client.schedule.update({
      where: { id },
      data: { status: 'archived', archivedAt: new Date(), deletedAt: new Date() },
      include: SCHEDULE_INCLUDE,
    });
  }

  async remove(id: string) {
    return this.archive(id);
  }

  async addEntry(scheduleId: string, dto: CreateScheduleEntryDto) {
    const schedule = await this.findOne(scheduleId);
    await this.validateEntryReferences(dto);
    await this.checkEntryConflicts(scheduleId, dto, schedule.id);

    return this.tenantPrisma.client.scheduleEntry.create({
      data: { scheduleId, ...dto },
      include: ENTRY_INCLUDE,
    });
  }

  async updateEntry(scheduleId: string, entryId: string, dto: UpdateScheduleEntryDto) {
    const schedule = await this.findOne(scheduleId);
    const existing = await this.tenantPrisma.client.scheduleEntry.findFirst({
      where: { id: entryId, scheduleId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException(`Schedule entry ${entryId} not found`);

    const merged = {
      subjectId: dto.subjectId ?? existing.subjectId,
      teacherProfileId: dto.teacherProfileId ?? existing.teacherProfileId,
      roomId: dto.roomId ?? existing.roomId,
      dayOfWeek: dto.dayOfWeek ?? existing.dayOfWeek ?? undefined,
      periodRowId: dto.periodRowId ?? existing.periodRowId ?? undefined,
      notes: dto.notes ?? existing.notes ?? undefined,
    };

    await this.validateEntryReferences(merged);
    await this.checkEntryConflicts(scheduleId, merged, schedule.id, entryId);

    return this.tenantPrisma.client.scheduleEntry.update({
      where: { id: entryId },
      data: dto,
      include: ENTRY_INCLUDE,
    });
  }

  async removeEntry(scheduleId: string, entryId: string) {
    const existing = await this.tenantPrisma.client.scheduleEntry.findFirst({
      where: { id: entryId, scheduleId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException(`Schedule entry ${entryId} not found`);
    return this.tenantPrisma.client.scheduleEntry.update({
      where: { id: entryId },
      data: { deletedAt: new Date() },
      include: ENTRY_INCLUDE,
    });
  }

  async listPeriodTemplates() {
    const templates = await this.tenantPrisma.client.periodTemplate.findMany({
      include: {
        academicYear: { select: ACADEMIC_YEAR_SELECT },
        rows: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: [{ academicYear: { label: 'desc' as const } }, { gradeLevel: 'asc' }],
    });
    return templates.map((template) => this.withDerivedPeriodTimes(template));
  }

  async createPeriodTemplate(dto: CreatePeriodTemplateDto) {
    try {
      const template = await this.tenantPrisma.client.periodTemplate.create({
        data: dto,
        include: {
          academicYear: { select: ACADEMIC_YEAR_SELECT },
          rows: { orderBy: { sortOrder: 'asc' } },
        },
      });
      return this.withDerivedPeriodTimes(template);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          `Period template for grade ${dto.gradeLevel} and academic year ${dto.academicYearId} already exists`,
        );
      }
      throw error;
    }
  }

  async updatePeriodTemplate(id: string, dto: UpdatePeriodTemplateDto) {
    const template = await this.tenantPrisma.client.periodTemplate.update({
      where: { id },
      data: dto,
      include: {
        academicYear: { select: ACADEMIC_YEAR_SELECT },
        rows: { orderBy: { sortOrder: 'asc' } },
      },
    });
    return this.withDerivedPeriodTimes(template);
  }

  async addPeriodRow(templateId: string, dto: CreatePeriodRowDto) {
    await this.tenantPrisma.client.periodTemplate.findUniqueOrThrow({ where: { id: templateId } });
    try {
      const row = await this.tenantPrisma.client.periodRow.create({
        data: { templateId, ...dto, activeDays: dto.activeDays ?? DEFAULT_ACTIVE_DAYS },
      });
      return row;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          `Period row sortOrder ${dto.sortOrder} already exists for this template`,
        );
      }
      throw error;
    }
  }

  async updatePeriodRow(id: string, dto: UpdatePeriodRowDto) {
    return this.tenantPrisma.client.periodRow.update({
      where: { id },
      data: dto,
    });
  }

  async removePeriodRow(id: string) {
    return this.tenantPrisma.client.periodRow.delete({ where: { id } });
  }

  private async ensureClassroom(classroomId: string) {
    const classroom = await this.tenantPrisma.client.classroom.findFirst({
      where: { id: classroomId, deletedAt: null },
      select: { id: true },
    });
    if (!classroom) throw new NotFoundException(`Classroom ${classroomId} not found`);
  }

  private requireRole(actor: CurrentUserContext, roles: UserRole[]) {
    if (!actor?.userId || !roles.includes(actor.role as UserRole)) {
      throw new ForbiddenException('You are not allowed to access this schedule resource');
    }
  }

  private async resolveAcademicYearId(academicYearId?: string) {
    if (academicYearId) return academicYearId;

    const activeYear = await this.tenantPrisma.client.academicYear.findFirst({
      where: { isActive: true },
      select: { id: true },
      orderBy: [{ label: 'desc' }, { semester: 'desc' }],
    });

    return activeYear?.id;
  }

  private async findPublishedStudentSchedules(studentProfileId: string, academicYearId?: string) {
    const schedules = await this.findByStudent(studentProfileId, academicYearId);
    return schedules.filter((schedule) => String(schedule.status) === PUBLISHED_STATUS);
  }

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
      nisn: profile.nisn,
      photoUrl: profile.photoUrl,
      avatarUrl: profile.user?.avatarUrl ?? null,
    };
  }

  private async notifySchedulePublished(schedule: {
    id: string;
    classroomId: string;
    academicYearId: string;
    academicYear: { label: string; semester: number };
    classroom: { name: string; gradeLevel: number };
    entries: Array<{ teacher: { user: { id: string } } }>;
  }) {
    const tenantSlug = getTenantContext().tenantSlug;
    const enrollments = await this.tenantPrisma.client.enrollment.findMany({
      where: { classroomId: schedule.classroomId, status: 'active', studentProfile: { status: 'active' } },
      include: {
        studentProfile: {
          select: {
            userId: true,
            guardians: { select: { userId: true } },
          },
        },
      },
    });

    const userIds = new Set<string>();
    for (const enrollment of enrollments) {
      userIds.add(enrollment.studentProfile.userId);
      for (const guardian of enrollment.studentProfile.guardians) {
        if (guardian.userId) userIds.add(guardian.userId);
      }
    }
    for (const entry of schedule.entries) {
      userIds.add(entry.teacher.user.id);
    }

    const title = 'Class schedule published';
    const body = `Schedule for ${schedule.classroom.name} semester ${schedule.academicYear.semester} has been published.`;
    await this.notifications.createManyAndQueue(
      [...userIds].map((userId) => ({
        tenantSlug,
        userId,
        title,
        body,
        category: NotificationCategory.academic,
        eventType: 'schedule_published',
        priority: NotificationPriority.normal,
        sourceType: NotificationSourceType.schedule,
        sourceId: schedule.id,
        data: {
          type: 'schedule_published',
          scheduleId: schedule.id,
          classroomId: schedule.classroomId,
          classroomName: schedule.classroom.name,
          gradeLevel: String(schedule.classroom.gradeLevel),
          academicYear: schedule.academicYear.label,
          academicYearId: schedule.academicYearId,
          semester: String(schedule.academicYear.semester),
        },
      })),
    );
  }

  private async validateEntryReferences(dto: CreateScheduleEntryDto) {
    const [subject, teacher, room] = await Promise.all([
      this.tenantPrisma.client.subject.findFirst({ where: { id: dto.subjectId, deletedAt: null }, select: { id: true } }),
      this.tenantPrisma.client.teacherProfile.findFirst({ where: { id: dto.teacherProfileId, status: 'active', deletedAt: null }, select: { id: true } }),
      this.tenantPrisma.client.room.findFirst({ where: { id: dto.roomId, deletedAt: null }, select: { id: true } }),
    ]);

    if (!subject) throw new NotFoundException(`Subject ${dto.subjectId} not found`);
    if (!teacher) throw new NotFoundException(`Active teacher profile ${dto.teacherProfileId} not found`);
    if (!room) throw new NotFoundException(`Room ${dto.roomId} not found`);

    // A teacher may only be assigned to teach once they hold an approved, in-force
    // SK Tugas Mengajar — i.e. a contract with status = active that has not expired.
    const teachingAuthorization = await this.tenantPrisma.client.teacherContract.findFirst({
      where: {
        teacherProfileId: dto.teacherProfileId,
        deletedAt: null,
        status: 'active',
        contractEndDate: { gte: new Date() },
      },
      select: { id: true },
    });
    if (!teachingAuthorization) {
      throw new ConflictException(
        'This teacher has no approved SK Tugas Mengajar (active teaching contract). ' +
          'Generate and have the school admin approve their contract before assigning teaching.',
      );
    }

    const isPlaced = dto.dayOfWeek !== undefined || dto.periodRowId !== undefined;
    const hasFullPlacement = dto.dayOfWeek !== undefined && dto.periodRowId !== undefined;
    if (isPlaced && !hasFullPlacement) {
      throw new BadRequestException('Placed entries require both dayOfWeek and periodRowId; omit both for tray items');
    }

    if (dto.periodRowId) {
      const period = await this.tenantPrisma.client.periodRow.findUnique({ where: { id: dto.periodRowId } });
      if (!period) throw new NotFoundException(`Period row ${dto.periodRowId} not found`);
    }
  }

  private async checkEntryConflicts(
    scheduleId: string,
    dto: CreateScheduleEntryDto,
    _scheduleIdForPublishedScope: string,
    excludeEntryId?: string,
  ) {
    if (!dto.dayOfWeek || !dto.periodRowId) return;

    const base = {
      dayOfWeek: dto.dayOfWeek,
      periodRowId: dto.periodRowId,
      deletedAt: null,
      ...(excludeEntryId ? { NOT: { id: excludeEntryId } } : {}),
    };

    const [cellConflict, teacherConflict, roomConflict] = await Promise.all([
      this.tenantPrisma.client.scheduleEntry.findFirst({
        where: { ...base, scheduleId },
        select: { id: true },
      }),
      this.tenantPrisma.client.scheduleEntry.findFirst({
        where: { ...base, teacherProfileId: dto.teacherProfileId, schedule: { status: { not: 'archived' }, deletedAt: null } },
        select: { id: true },
      }),
      this.tenantPrisma.client.scheduleEntry.findFirst({
        where: { ...base, roomId: dto.roomId, schedule: { status: { not: 'archived' }, deletedAt: null } },
        select: { id: true },
      }),
    ]);

    if (cellConflict) throw new ConflictException('This schedule already has a block in that day and period');
    if (teacherConflict) throw new ConflictException('This teacher already has a block in that day and period');
    if (roomConflict) throw new ConflictException('This room already has a block in that day and period');
  }

  private withDerivedPeriodTimes<T extends { dayStart: string; rows: Array<{ durationMin: number }> }>(template: T) {
    let cursor = this.timeToMinutes(template.dayStart);
    return {
      ...template,
      rows: template.rows.map((row) => {
        const startTime = this.minutesToTime(cursor);
        cursor += row.durationMin;
        return { ...row, startTime, endTime: this.minutesToTime(cursor) };
      }),
    };
  }

  private timeToMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minutesToTime(value: number): string {
    const hours = Math.floor(value / 60) % 24;
    const minutes = value % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
}

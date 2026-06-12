import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { StorageService } from '../storage/storage.service';
import { UserRole } from '../common/enums/user-role.enum';
import { paginatedResult } from '../common/utils/paginate';
import {
  AssignmentTypeDto,
  CreateAssignmentDto,
} from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { FindAssignmentsQueryDto } from './dto/find-assignments-query.dto';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { UpdateMySubmissionDto } from './dto/update-my-submission.dto';
import { FindGradebookQueryDto } from './dto/find-gradebook-query.dto';
import { FindStudentAssignmentsQueryDto } from './dto/find-student-assignments-query.dto';
import { FindParentAssignmentsQueryDto } from './dto/find-parent-assignments-query.dto';

type CurrentUserContext = {
  userId: string;
  role?: string;
  tenantSlug?: string;
};

const ALLOWED_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed',
];
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB — matches BODY_LIMIT

// Minimal actor reference for createdBy/gradedBy.
const USER_REF_SELECT = { id: true, fullName: true };

const CLASSROOM_SELECT = { id: true, name: true, gradeLevel: true };
const SUBJECT_SELECT = { id: true, code: true, name: true };
const ACADEMIC_YEAR_SELECT = { id: true, label: true, semester: true };

// Public-safe student card — no email/username (same shape as attendance).
const STUDENT_SELECT = {
  id: true,
  userId: true,
  nisn: true,
  photoUrl: true,
  user: { select: { id: true, fullName: true, avatarUrl: true } },
};

const ATTACHMENT_SELECT = {
  id: true,
  fileUrl: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
};

const ASSIGNMENT_INCLUDE = {
  classroom: { select: CLASSROOM_SELECT },
  subject: { select: SUBJECT_SELECT },
  academicYear: { select: ACADEMIC_YEAR_SELECT },
  createdBy: { select: USER_REF_SELECT },
  attachments: { select: ATTACHMENT_SELECT },
};

const SUBMISSION_INCLUDE = {
  attachments: { select: ATTACHMENT_SELECT },
  gradedBy: { select: USER_REF_SELECT },
};

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly tenantPrisma: PrismaTenantService,
    private readonly storage: StorageService,
  ) {}

  // ── Teacher: CRUD + lifecycle ─────────────────────────────────────────────

  async create(actor: CurrentUserContext, dto: CreateAssignmentDto) {
    this.requireRole(actor, [UserRole.teacher]);

    if (dto.type === AssignmentTypeDto.online_exam) {
      throw new BadRequestException(
        'online_exam assignments are not available yet',
      );
    }

    const db = this.tenantPrisma.client;
    const teacher = await this.getTeacherProfile(actor);

    const classroom = await db.classroom.findFirst({
      where: {
        id: dto.classroomId,
        academicYearId: dto.academicYearId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!classroom) {
      throw new NotFoundException(
        `Classroom ${dto.classroomId} not found for academic year ${dto.academicYearId}`,
      );
    }

    const subject = await db.subject.findFirst({
      where: { id: dto.subjectId, deletedAt: null },
      select: { id: true },
    });
    if (!subject)
      throw new NotFoundException(`Subject ${dto.subjectId} not found`);
    
    await this.ensureSubjectTeacher(teacher.id, dto.classroomId, dto.subjectId);

    const created = await db.assignment.create({
      data: {
        classroomId: dto.classroomId,
        subjectId: dto.subjectId,
        academicYearId: dto.academicYearId,
        createdByUserId: actor.userId,
        title: dto.title,
        description: dto.description ?? null,
        dueAt: new Date(dto.dueAt),
        maxScore: dto.maxScore ?? 100,
        allowLateSubmission: dto.allowLateSubmission ?? true,
      },
      include: ASSIGNMENT_INCLUDE,
    });

    return this.mapAssignment(created);
  }

  async findAll(actor: CurrentUserContext, query: FindAssignmentsQueryDto) {
    const role = actor.role as UserRole;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const db = this.tenantPrisma.client;

    if (role === UserRole.parent) {
      throw new ForbiddenException(
        'Parents should use GET /assignments/parent',
      );
    }

    const where: any = {
      deletedAt: null,
      ...(query.classroomId ? { classroomId: query.classroomId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.dueFrom || query.dueTo
        ? {
            dueAt: {
              ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
              ...(query.dueTo ? { lte: new Date(query.dueTo) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    let include: any = ASSIGNMENT_INCLUDE;
    let studentProfileId: string | null = null;

    if (role === UserRole.teacher) {
      const teacher = await this.getTeacherProfile(actor);
      const pairs = await this.teacherPairs(teacher.id);
      if (!pairs.length) return paginatedResult([], 0, page, limit);
      where.AND = [
        {
          OR: pairs.map((p) => ({
            classroomId: p.classroomId,
            subjectId: p.subjectId,
          })),
        },
      ];
    } else if (role === UserRole.student) {
      const profile = await this.getStudentProfile(actor);
      studentProfileId = profile.id;
      const classroomIds = await this.activeClassroomIds(profile.id);
      if (!classroomIds.length) return paginatedResult([], 0, page, limit);
      where.classroomId =
        query.classroomId && classroomIds.includes(query.classroomId)
          ? query.classroomId
          : { in: classroomIds };
      // Students never see drafts.
      where.status =
        query.status && query.status !== 'draft'
          ? query.status
          : { in: ['published', 'closed'] };
      include = {
        ...ASSIGNMENT_INCLUDE,
        submissions: {
          where: { studentProfileId: profile.id, deletedAt: null },
          include: SUBMISSION_INCLUDE,
        },
      };
    } else {
      this.requireRole(actor, [UserRole.principal, UserRole.school_admin]);
    }

    const [rows, total] = await Promise.all([
      db.assignment.findMany({
        where,
        include,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { dueAt: 'desc' },
      }),
      db.assignment.count({ where }),
    ]);

    const data = rows.map((row: any) => ({
      ...this.mapAssignment(row),
      ...(studentProfileId
        ? {
            mySubmission: row.submissions?.[0]
              ? this.mapSubmission(row.submissions[0])
              : null,
          }
        : {}),
    }));

    return paginatedResult(data, total, page, limit);
  }

  async findOne(actor: CurrentUserContext, id: string) {
    const db = this.tenantPrisma.client;
    const assignment = await this.getAssignment(id);

    switch (actor.role) {
      case UserRole.teacher: {
        const teacher = await this.getTeacherProfile(actor);
        await this.ensureSubjectTeacher(
          teacher.id,
          assignment.classroomId,
          assignment.subjectId,
        );
        const summary = await this.buildAssignmentSummary(
          assignment.id,
          assignment.classroomId,
        );
        return { ...this.mapAssignment(assignment), summary };
      }

      case UserRole.principal:
      case UserRole.school_admin: {
        const summary = await this.buildAssignmentSummary(
          assignment.id,
          assignment.classroomId,
        );
        return { ...this.mapAssignment(assignment), summary };
      }

      case UserRole.student: {
        const profile = await this.getStudentProfile(actor);
        await this.ensureEnrolled(profile.id, assignment.classroomId);
        if (assignment.status === 'draft')
          throw new NotFoundException(`Assignment ${id} not found`);
        const submission = await db.assignmentSubmission.findUnique({
          where: {
            assignmentId_studentProfileId: {
              assignmentId: id,
              studentProfileId: profile.id,
            },
          },
          include: SUBMISSION_INCLUDE,
        });
        return {
          ...this.mapAssignment(assignment),
          mySubmission:
            submission && !submission.deletedAt
              ? this.mapSubmission(submission)
              : null,
        };
      }

      case UserRole.parent: {
        if (assignment.status === 'draft')
          throw new NotFoundException(`Assignment ${id} not found`);
        const children = await this.getParentChildren(actor.userId);
        const enrolled = children.filter((child: any) =>
          child.enrollments.some(
            (e: any) => e.classroom.id === assignment.classroomId,
          ),
        );
        if (!enrolled.length) {
          throw new ForbiddenException(
            'None of your linked students belong to this class',
          );
        }
        const submissions = await db.assignmentSubmission.findMany({
          where: {
            assignmentId: id,
            studentProfileId: { in: enrolled.map((c: any) => c.id) },
            deletedAt: null,
          },
          include: SUBMISSION_INCLUDE,
        });
        const byStudent = new Map(
          submissions.map((s: any) => [s.studentProfileId, s]),
        );
        return {
          ...this.mapAssignment(assignment),
          childSubmissions: enrolled.map((child: any) => ({
            student: this.mapStudent(child),
            submission: byStudent.has(child.id)
              ? this.mapSubmission(byStudent.get(child.id))
              : null,
          })),
        };
      }

      default:
        throw new ForbiddenException(
          'You are not allowed to access this assignment',
        );
    }
  }

  async update(
    actor: CurrentUserContext,
    id: string,
    dto: UpdateAssignmentDto,
  ) {
    const db = this.tenantPrisma.client;
    const assignment = await this.getAssignment(id);
    await this.ensureTeacherOwns(actor, assignment);

    if (assignment.status === 'closed') {
      throw new ConflictException('Closed assignments cannot be edited');
    }

    if (dto.maxScore !== undefined) {
      const highest = await db.assignmentSubmission.aggregate({
        where: { assignmentId: id, deletedAt: null, score: { not: null } },
        _max: { score: true },
      });
      const maxGraded = highest._max.score;
      if (maxGraded !== null && dto.maxScore < Number(maxGraded)) {
        throw new BadRequestException(
          `maxScore cannot be lower than an already-graded score (${Number(maxGraded)})`,
        );
      }
    }

    const updated = await db.assignment.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.dueAt !== undefined ? { dueAt: new Date(dto.dueAt) } : {}),
        ...(dto.maxScore !== undefined ? { maxScore: dto.maxScore } : {}),
        ...(dto.allowLateSubmission !== undefined
          ? { allowLateSubmission: dto.allowLateSubmission }
          : {}),
      },
      include: ASSIGNMENT_INCLUDE,
    });

    return this.mapAssignment(updated);
  }

  async remove(actor: CurrentUserContext, id: string) {
    const assignment = await this.getAssignment(id);
    await this.ensureTeacherOwns(actor, assignment);
    await this.tenantPrisma.client.assignment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async publish(actor: CurrentUserContext, id: string) {
    const assignment = await this.getAssignment(id);
    await this.ensureTeacherOwns(actor, assignment);
    if (assignment.status !== 'draft') {
      throw new ConflictException('Only draft assignments can be published');
    }
    const updated = await this.tenantPrisma.client.assignment.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date() },
      include: ASSIGNMENT_INCLUDE,
    });
    return this.mapAssignment(updated);
  }

  async close(actor: CurrentUserContext, id: string) {
    const assignment = await this.getAssignment(id);
    await this.ensureTeacherOwns(actor, assignment);
    if (assignment.status !== 'published') {
      throw new ConflictException('Only published assignments can be closed');
    }
    const updated = await this.tenantPrisma.client.assignment.update({
      where: { id },
      data: { status: 'closed', closedAt: new Date() },
      include: ASSIGNMENT_INCLUDE,
    });
    return this.mapAssignment(updated);
  }

  // ── Teacher: instruction attachments ──────────────────────────────────────

  async addAttachment(
    actor: CurrentUserContext,
    id: string,
    file: Express.Multer.File,
    tenantSlug: string,
  ) {
    const assignment = await this.getAssignment(id);
    await this.ensureTeacherOwns(actor, assignment);
    if (assignment.status === 'closed') {
      throw new ConflictException('Closed assignments cannot be modified');
    }
    this.validateFile(file);

    const fileUrl = await this.storage.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      'assignment-files',
      tenantSlug,
    );

    return this.tenantPrisma.client.assignmentAttachment.create({
      data: {
        assignmentId: id,
        fileUrl,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
      select: ATTACHMENT_SELECT,
    });
  }

  async removeAttachment(
    actor: CurrentUserContext,
    id: string,
    attachmentId: string,
  ) {
    const assignment = await this.getAssignment(id);
    await this.ensureTeacherOwns(actor, assignment);

    const attachment =
      await this.tenantPrisma.client.assignmentAttachment.findFirst({
        where: { id: attachmentId, assignmentId: id },
      });
    if (!attachment)
      throw new NotFoundException(`Attachment ${attachmentId} not found`);

    await this.storage.delete(attachment.fileUrl);
    await this.tenantPrisma.client.assignmentAttachment.delete({
      where: { id: attachmentId },
    });
  }

  // ── Student: own submission ───────────────────────────────────────────────

  async submitFile(
    actor: CurrentUserContext,
    assignmentId: string,
    file: Express.Multer.File,
    tenantSlug: string,
  ) {
    this.requireRole(actor, [UserRole.student]);
    const db = this.tenantPrisma.client;
    const profile = await this.getStudentProfile(actor);
    const assignment = await this.getAssignment(assignmentId);

    if (assignment.type !== 'file_upload') {
      throw new BadRequestException(
        'This assignment does not accept file submissions',
      );
    }
    if (assignment.status === 'draft') {
      throw new NotFoundException(`Assignment ${assignmentId} not found`);
    }
    if (assignment.status === 'closed') {
      throw new ConflictException(
        'This assignment is closed and no longer accepts submissions',
      );
    }
    await this.ensureEnrolled(profile.id, assignment.classroomId);
    this.validateFile(file);

    const existing = await db.assignmentSubmission.findUnique({
      where: {
        assignmentId_studentProfileId: {
          assignmentId,
          studentProfileId: profile.id,
        },
      },
    });
    if (existing && !existing.deletedAt && existing.status === 'graded') {
      throw new ConflictException(
        'Your submission has already been graded — ask your teacher to return it before resubmitting',
      );
    }

    const now = new Date();
    const isLate = now > assignment.dueAt;
    if (isLate && !assignment.allowLateSubmission) {
      throw new BadRequestException(
        'The deadline has passed and late submissions are not allowed',
      );
    }

    const submission = existing
      ? await db.assignmentSubmission.update({
          where: { id: existing.id },
          data: {
            submittedAt: now,
            isLate,
            status: 'submitted',
            deletedAt: null,
            ...(existing.status === 'returned'
              ? { attemptNumber: { increment: 1 } }
              : {}),
          },
        })
      : await db.assignmentSubmission.create({
          data: { assignmentId, studentProfileId: profile.id, isLate },
        });

    const fileUrl = await this.storage.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      'assignment-submissions',
      tenantSlug,
    );
    await db.submissionAttachment.create({
      data: {
        submissionId: submission.id,
        fileUrl,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    });

    const fresh = await db.assignmentSubmission.findUnique({
      where: { id: submission.id },
      include: SUBMISSION_INCLUDE,
    });
    return this.mapSubmission(fresh);
  }

  async removeMySubmissionAttachment(
    actor: CurrentUserContext,
    assignmentId: string,
    attachmentId: string,
  ) {
    this.requireRole(actor, [UserRole.student]);
    const db = this.tenantPrisma.client;
    const profile = await this.getStudentProfile(actor);

    const submission = await db.assignmentSubmission.findUnique({
      where: {
        assignmentId_studentProfileId: {
          assignmentId,
          studentProfileId: profile.id,
        },
      },
    });
    if (!submission || submission.deletedAt) {
      throw new NotFoundException('You have no submission for this assignment');
    }
    if (submission.status === 'graded') {
      throw new ConflictException('Graded submissions cannot be modified');
    }

    const attachment = await db.submissionAttachment.findFirst({
      where: { id: attachmentId, submissionId: submission.id },
    });
    if (!attachment)
      throw new NotFoundException(`Attachment ${attachmentId} not found`);

    await this.storage.delete(attachment.fileUrl);
    await db.submissionAttachment.delete({ where: { id: attachmentId } });
  }

  async updateMySubmission(
    actor: CurrentUserContext,
    assignmentId: string,
    dto: UpdateMySubmissionDto,
  ) {
    this.requireRole(actor, [UserRole.student]);
    const db = this.tenantPrisma.client;
    const profile = await this.getStudentProfile(actor);

    const submission = await db.assignmentSubmission.findUnique({
      where: {
        assignmentId_studentProfileId: {
          assignmentId,
          studentProfileId: profile.id,
        },
      },
    });
    if (!submission || submission.deletedAt) {
      throw new NotFoundException('You have no submission for this assignment');
    }
    if (submission.status === 'graded') {
      throw new ConflictException('Graded submissions cannot be modified');
    }

    const updated = await db.assignmentSubmission.update({
      where: { id: submission.id },
      data: { notes: dto.notes ?? null },
      include: SUBMISSION_INCLUDE,
    });
    return this.mapSubmission(updated);
  }

  async getMySubmission(actor: CurrentUserContext, assignmentId: string) {
    this.requireRole(actor, [UserRole.student]);
    const db = this.tenantPrisma.client;
    const profile = await this.getStudentProfile(actor);
    const assignment = await this.getAssignment(assignmentId);

    if (assignment.status === 'draft') {
      throw new NotFoundException(`Assignment ${assignmentId} not found`);
    }
    await this.ensureEnrolled(profile.id, assignment.classroomId);

    const submission = await db.assignmentSubmission.findUnique({
      where: {
        assignmentId_studentProfileId: {
          assignmentId,
          studentProfileId: profile.id,
        },
      },
      include: SUBMISSION_INCLUDE,
    });

    return {
      assignment: this.mapAssignment(assignment),
      submission:
        submission && !submission.deletedAt
          ? this.mapSubmission(submission)
          : null,
    };
  }

  // ── Teacher: submissions + grading ────────────────────────────────────────

  async listSubmissions(actor: CurrentUserContext, assignmentId: string) {
    const db = this.tenantPrisma.client;
    const assignment = await this.getAssignment(assignmentId);

    if (actor.role === UserRole.teacher) {
      const teacher = await this.getTeacherProfile(actor);
      await this.ensureSubjectTeacher(
        teacher.id,
        assignment.classroomId,
        assignment.subjectId,
      );
    } else {
      this.requireRole(actor, [UserRole.principal, UserRole.school_admin]);
    }

    const [enrollments, submissions] = await Promise.all([
      db.enrollment.findMany({
        where: { classroomId: assignment.classroomId, status: 'active' },
        include: { studentProfile: { select: STUDENT_SELECT } },
        orderBy: { enrolledAt: 'asc' },
      }),
      db.assignmentSubmission.findMany({
        where: { assignmentId, deletedAt: null },
        include: SUBMISSION_INCLUDE,
      }),
    ]);

    const byStudent = new Map(
      submissions.map((s: any) => [s.studentProfileId, s]),
    );

    return {
      assignment: this.mapAssignment(assignment),
      students: enrollments.map((enrollment: any) => ({
        student: this.mapStudent(enrollment.studentProfile),
        submission: byStudent.has(enrollment.studentProfile.id)
          ? this.mapSubmission(byStudent.get(enrollment.studentProfile.id))
          : null,
      })),
      summary: this.buildSubmissionSummary(enrollments.length, submissions),
    };
  }

  async gradeSubmission(
    actor: CurrentUserContext,
    assignmentId: string,
    submissionId: string,
    dto: GradeSubmissionDto,
  ) {
    const db = this.tenantPrisma.client;
    const assignment = await this.getAssignment(assignmentId);
    await this.ensureTeacherOwns(actor, assignment);

    const submission = await db.assignmentSubmission.findFirst({
      where: { id: submissionId, assignmentId, deletedAt: null },
    });
    if (!submission)
      throw new NotFoundException(`Submission ${submissionId} not found`);

    const maxScore = Number(assignment.maxScore);
    if (dto.score > maxScore) {
      throw new BadRequestException(
        `Score cannot exceed the assignment maxScore (${maxScore})`,
      );
    }

    const graded = await db.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        score: dto.score,
        feedback: dto.feedback ?? null,
        status: 'graded',
        gradedByUserId: actor.userId,
        gradedAt: new Date(),
      },
      include: {
        ...SUBMISSION_INCLUDE,
        studentProfile: { select: STUDENT_SELECT },
      },
    });

    return {
      student: this.mapStudent(graded.studentProfile),
      submission: this.mapSubmission(graded),
    };
  }

  async returnSubmission(
    actor: CurrentUserContext,
    assignmentId: string,
    submissionId: string,
  ) {
    const db = this.tenantPrisma.client;
    const assignment = await this.getAssignment(assignmentId);
    await this.ensureTeacherOwns(actor, assignment);

    const submission = await db.assignmentSubmission.findFirst({
      where: { id: submissionId, assignmentId, deletedAt: null },
    });
    if (!submission)
      throw new NotFoundException(`Submission ${submissionId} not found`);
    if (submission.status !== 'graded') {
      throw new ConflictException(
        'Only graded submissions can be returned for revision',
      );
    }

    const returned = await db.assignmentSubmission.update({
      where: { id: submissionId },
      data: { status: 'returned' },
      include: {
        ...SUBMISSION_INCLUDE,
        studentProfile: { select: STUDENT_SELECT },
      },
    });

    return {
      student: this.mapStudent(returned.studentProfile),
      submission: this.mapSubmission(returned),
    };
  }

  // ── Tracking views ────────────────────────────────────────────────────────

  async gradebook(actor: CurrentUserContext, query: FindGradebookQueryDto) {
    const db = this.tenantPrisma.client;

    if (actor.role === UserRole.teacher) {
      const teacher = await this.getTeacherProfile(actor);
      await this.ensureSubjectTeacher(
        teacher.id,
        query.classroomId,
        query.subjectId,
      );
    } else {
      this.requireRole(actor, [UserRole.principal, UserRole.school_admin]);
    }

    const [classroom, subject] = await Promise.all([
      db.classroom.findFirst({
        where: { id: query.classroomId, deletedAt: null },
        select: CLASSROOM_SELECT,
      }),
      db.subject.findFirst({
        where: { id: query.subjectId, deletedAt: null },
        select: SUBJECT_SELECT,
      }),
    ]);
    if (!classroom)
      throw new NotFoundException(`Classroom ${query.classroomId} not found`);
    if (!subject)
      throw new NotFoundException(`Subject ${query.subjectId} not found`);

    const assignments = await db.assignment.findMany({
      where: {
        classroomId: query.classroomId,
        subjectId: query.subjectId,
        deletedAt: null,
        status: { in: ['published', 'closed'] },
        ...(query.academicYearId
          ? { academicYearId: query.academicYearId }
          : {}),
      },
      select: {
        id: true,
        title: true,
        dueAt: true,
        maxScore: true,
        status: true,
      },
      orderBy: { dueAt: 'asc' },
    });
    const assignmentIds = assignments.map((a: any) => a.id);

    const [enrollments, submissions] = await Promise.all([
      db.enrollment.findMany({
        where: { classroomId: query.classroomId, status: 'active' },
        include: { studentProfile: { select: STUDENT_SELECT } },
        orderBy: { enrolledAt: 'asc' },
      }),
      assignmentIds.length
        ? db.assignmentSubmission.findMany({
            where: { assignmentId: { in: assignmentIds }, deletedAt: null },
            select: {
              assignmentId: true,
              studentProfileId: true,
              score: true,
              status: true,
              isLate: true,
            },
          })
        : Promise.resolve([] as any[]),
    ]);

    const cellByKey = new Map(
      submissions.map((s: any) => [
        `${s.assignmentId}|${s.studentProfileId}`,
        s,
      ]),
    );

    const students = enrollments.map((enrollment: any) => {
      const cells = assignments.map((a: any) => {
        const cell = cellByKey.get(`${a.id}|${enrollment.studentProfile.id}`);
        return cell
          ? {
              assignmentId: a.id,
              status: cell.status,
              isLate: cell.isLate,
              score: cell.score === null ? null : Number(cell.score),
            }
          : null;
      });
      const scores = cells
        .filter((c: any) => c && c.score !== null)
        .map((c: any) => c.score as number);
      return {
        student: this.mapStudent(enrollment.studentProfile),
        cells,
        average: scores.length
          ? round2(
              scores.reduce((a: number, b: number) => a + b, 0) / scores.length,
            )
          : null,
        completion: assignments.length
          ? round2((cells.filter(Boolean).length / assignments.length) * 100)
          : 0,
      };
    });

    const assignmentsOut = assignments.map((a: any) => {
      const scores = submissions
        .filter((s: any) => s.assignmentId === a.id && s.score !== null)
        .map((s: any) => Number(s.score));
      return {
        id: a.id,
        title: a.title,
        dueAt: a.dueAt,
        status: a.status,
        maxScore: Number(a.maxScore),
        averageScore: scores.length
          ? round2(
              scores.reduce((x: number, y: number) => x + y, 0) / scores.length,
            )
          : null,
      };
    });

    const allScores = submissions
      .filter((s: any) => s.score !== null)
      .map((s: any) => Number(s.score));

    return {
      classroom,
      subject,
      filters: { academicYearId: query.academicYearId ?? null },
      assignments: assignmentsOut,
      students,
      summary: {
        enrolled: enrollments.length,
        totalAssignments: assignments.length,
        classAverage: allScores.length
          ? round2(
              allScores.reduce((a: number, b: number) => a + b, 0) /
                allScores.length,
            )
          : null,
      },
    };
  }

  async findStudentAssignments(
    actor: CurrentUserContext,
    studentId: string,
    query: FindStudentAssignmentsQueryDto,
  ) {
    this.requireRole(actor, [
      UserRole.student,
      UserRole.parent,
      UserRole.teacher,
      UserRole.principal,
      UserRole.school_admin,
    ]);
    const db = this.tenantPrisma.client;

    const student = await db.studentProfile.findFirst({
      where: {
        OR: [{ id: studentId }, { userId: studentId }],
        status: 'active',
      },
      select: STUDENT_SELECT,
    });
    if (!student) throw new NotFoundException(`Student ${studentId} not found`);
    await this.ensureCanReadStudentAssignments(
      actor,
      student.id,
      student.userId,
    );

    const classroomIds = await this.activeClassroomIds(student.id);
    const assignments = classroomIds.length
      ? await db.assignment.findMany({
          where: {
            classroomId: { in: classroomIds },
            deletedAt: null,
            status: { in: ['published', 'closed'] },
            ...(query.subjectId ? { subjectId: query.subjectId } : {}),
            ...(query.academicYearId
              ? { academicYearId: query.academicYearId }
              : {}),
          },
          include: {
            ...ASSIGNMENT_INCLUDE,
            submissions: {
              where: { studentProfileId: student.id, deletedAt: null },
              include: SUBMISSION_INCLUDE,
            },
          },
          orderBy: { dueAt: 'desc' },
        })
      : [];

    const items = assignments.map((a: any) => ({
      ...this.mapAssignment(a),
      mySubmission: a.submissions?.[0]
        ? this.mapSubmission(a.submissions[0])
        : null,
    }));

    return {
      student: this.mapStudent(student),
      filters: {
        subjectId: query.subjectId ?? null,
        academicYearId: query.academicYearId ?? null,
      },
      summary: this.buildStudentSummary(items),
      assignments: items,
    };
  }

  async findParentAssignments(
    actor: CurrentUserContext,
    query: FindParentAssignmentsQueryDto,
  ) {
    this.requireRole(actor, [UserRole.parent]);
    const db = this.tenantPrisma.client;

    const children = await this.getParentChildren(
      actor.userId,
      query.studentProfileId,
    );
    const childIds = children.map((child: any) => child.id);
    const classroomIds = unique(
      children.flatMap((child: any) =>
        child.enrollments.map((e: any) => e.classroom.id),
      ),
    );

    const assignments = classroomIds.length
      ? await db.assignment.findMany({
          where: {
            classroomId: { in: classroomIds },
            deletedAt: null,
            status: { in: ['published', 'closed'] },
            ...(query.academicYearId
              ? { academicYearId: query.academicYearId }
              : {}),
            ...(query.subjectId ? { subjectId: query.subjectId } : {}),
          },
          include: ASSIGNMENT_INCLUDE,
          orderBy: { dueAt: 'desc' },
        })
      : [];
    const assignmentIds = assignments.map((a: any) => a.id);

    const submissions = assignmentIds.length
      ? await db.assignmentSubmission.findMany({
          where: {
            assignmentId: { in: assignmentIds },
            studentProfileId: { in: childIds },
            deletedAt: null,
          },
          include: SUBMISSION_INCLUDE,
        })
      : [];
    const subByKey = new Map(
      submissions.map((s: any) => [
        `${s.assignmentId}|${s.studentProfileId}`,
        s,
      ]),
    );

    return {
      parent: { userId: actor.userId },
      filters: {
        studentProfileId: query.studentProfileId ?? null,
        academicYearId: query.academicYearId ?? null,
        subjectId: query.subjectId ?? null,
      },
      children: children.map((child: any) => {
        const childClassrooms = new Set(
          child.enrollments.map((e: any) => e.classroom.id),
        );
        const items = assignments
          .filter((a: any) => childClassrooms.has(a.classroomId))
          .map((a: any) => {
            const sub = subByKey.get(`${a.id}|${child.id}`);
            return {
              ...this.mapAssignment(a),
              mySubmission: sub ? this.mapSubmission(sub) : null,
            };
          });
        return {
          student: this.mapStudent(child),
          guardian: child.guardian,
          classrooms: child.enrollments.map((e: any) => e.classroom),
          summary: this.buildStudentSummary(items),
          assignments: items,
        };
      }),
    };
  }

  /** The (classroom, subject, academicYear) pairs this teacher teaches — powers the create form. */
  async getTeachingContext(actor: CurrentUserContext) {
    this.requireRole(actor, [UserRole.teacher]);
    const db = this.tenantPrisma.client;
    const teacher = await this.getTeacherProfile(actor);
    const pairs = await this.teacherPairs(teacher.id);
    if (!pairs.length) return { teacher: { id: teacher.id }, pairs: [] };

    const [classrooms, subjects] = await Promise.all([
      db.classroom.findMany({
        where: { id: { in: unique(pairs.map((p) => p.classroomId)) }, deletedAt: null },
        select: {
          ...CLASSROOM_SELECT,
          academicYearId: true,
          academicYear: { select: ACADEMIC_YEAR_SELECT },
        },
      }),
      db.subject.findMany({
        where: { id: { in: unique(pairs.map((p) => p.subjectId)) }, deletedAt: null },
        select: SUBJECT_SELECT,
      }),
    ]);
    const classroomById = new Map(classrooms.map((c: any) => [c.id, c]));
    const subjectById = new Map(subjects.map((s: any) => [s.id, s]));

    const enriched = pairs
      .map((pair) => {
        const classroom: any = classroomById.get(pair.classroomId);
        const subject: any = subjectById.get(pair.subjectId);
        if (!classroom || !subject) return null; // soft-deleted classroom/subject
        return {
          classroom: {
            id: classroom.id,
            name: classroom.name,
            gradeLevel: classroom.gradeLevel,
            academicYearId: classroom.academicYearId,
          },
          subject,
          academicYear: classroom.academicYear,
        };
      })
      .filter(Boolean) as Array<{
      classroom: { id: string; name: string; gradeLevel: number; academicYearId: string };
      subject: { id: string; code: string | null; name: string };
      academicYear: { id: string; label: string; semester: number };
    }>;

    enriched.sort(
      (a, b) =>
        a.classroom.name.localeCompare(b.classroom.name) ||
        a.subject.name.localeCompare(b.subject.name),
    );

    return { teacher: { id: teacher.id }, pairs: enriched };
  }

  // ── Authorization helpers ─────────────────────────────────────────────────

  private requireRole(actor: CurrentUserContext, roles: UserRole[]) {
    if (!actor?.userId || !roles.includes(actor.role as UserRole)) {
      throw new ForbiddenException(
        'You are not allowed to access this assignment resource',
      );
    }
  }

  private async getTeacherProfile(actor: CurrentUserContext) {
    const teacher = await this.tenantPrisma.client.teacherProfile.findFirst({
      where: { userId: actor.userId, status: 'active', deletedAt: null },
      select: { id: true, userId: true },
    });
    if (!teacher)
      throw new NotFoundException(
        'Active teacher profile not found for current user',
      );
    return teacher;
  }

  private async getStudentProfile(actor: CurrentUserContext) {
    const profile = await this.tenantPrisma.client.studentProfile.findFirst({
      where: { userId: actor.userId, status: 'active' },
      select: { id: true, userId: true },
    });
    if (!profile)
      throw new NotFoundException(
        'Active student profile not found for current user',
      );
    return profile;
  }

  /** The subject teacher for (classroom, subject) — ClassSubject first, ScheduleEntry fallback. */
  private async teacherTeachesPair(
    teacherProfileId: string,
    classroomId: string,
    subjectId: string,
  ) {
    const db = this.tenantPrisma.client;
    const classSubject = await db.classSubject.findFirst({
      where: { classroomId, subjectId, teacherProfileId },
      select: { id: true },
    });
    if (classSubject) return true;

    const entry = await db.scheduleEntry.findFirst({
      where: {
        teacherProfileId,
        subjectId,
        deletedAt: null,
        schedule: { classroomId, deletedAt: null },
      },
      select: { id: true },
    });
    return Boolean(entry);
  }

  private async ensureSubjectTeacher(
    teacherProfileId: string,
    classroomId: string,
    subjectId: string,
  ) {
    if (
      !(await this.teacherTeachesPair(teacherProfileId, classroomId, subjectId))
    ) {
      throw new ForbiddenException(
        'Only the assigned subject teacher can manage assignments for this class and subject',
      );
    }
  }

  private async ensureTeacherOwns(actor: CurrentUserContext, assignment: any) {
    this.requireRole(actor, [UserRole.teacher]);
    const teacher = await this.getTeacherProfile(actor);
    await this.ensureSubjectTeacher(
      teacher.id,
      assignment.classroomId,
      assignment.subjectId,
    );
    return teacher;
  }

  /** Unique (classroomId, subjectId) pairs this teacher teaches. */
  private async teacherPairs(teacherProfileId: string) {
    const db = this.tenantPrisma.client;
    const [classSubjects, entries] = await Promise.all([
      db.classSubject.findMany({
        where: { teacherProfileId },
        select: { classroomId: true, subjectId: true },
      }),
      db.scheduleEntry.findMany({
        where: {
          teacherProfileId,
          deletedAt: null,
          schedule: { deletedAt: null },
        },
        select: {
          subjectId: true,
          schedule: { select: { classroomId: true } },
        },
      }),
    ]);

    const pairs = new Map<string, { classroomId: string; subjectId: string }>();
    for (const cs of classSubjects) {
      pairs.set(`${cs.classroomId}|${cs.subjectId}`, cs);
    }
    for (const entry of entries) {
      const pair = {
        classroomId: entry.schedule.classroomId,
        subjectId: entry.subjectId,
      };
      pairs.set(`${pair.classroomId}|${pair.subjectId}`, pair);
    }
    return [...pairs.values()];
  }

  private async ensureEnrolled(studentProfileId: string, classroomId: string) {
    const enrollment = await this.tenantPrisma.client.enrollment.findFirst({
      where: { studentProfileId, classroomId, status: 'active' },
      select: { id: true },
    });
    if (!enrollment) {
      throw new ForbiddenException(
        'You are not actively enrolled in this class',
      );
    }
  }

  /** Deny-by-default read gate — mirrors attendance's ensureCanReadStudentAttendance. */
  private async ensureCanReadStudentAssignments(
    actor: CurrentUserContext,
    studentProfileId: string,
    studentUserId: string,
  ) {
    switch (actor.role) {
      case UserRole.student:
        if (actor.userId === studentUserId) return;
        throw new ForbiddenException(
          'Students can only view their own assignments',
        );

      case UserRole.parent: {
        const guardian = await this.tenantPrisma.client.guardian.findFirst({
          where: { userId: actor.userId, studentProfileId },
          select: { id: true },
        });
        if (guardian) return;
        throw new ForbiddenException(
          'Parents can only view assignments for linked students',
        );
      }

      case UserRole.teacher: {
        if (await this.teacherCanReadStudent(actor.userId, studentProfileId))
          return;
        throw new ForbiddenException(
          'Teachers can only view assignments for assigned students',
        );
      }

      case UserRole.principal:
      case UserRole.school_admin:
        return;

      default:
        throw new ForbiddenException(
          'You cannot view this student assignments',
        );
    }
  }

  private async teacherCanReadStudent(
    teacherUserId: string,
    studentProfileId: string,
  ) {
    const db = this.tenantPrisma.client;
    const teacher = await db.teacherProfile.findFirst({
      where: { userId: teacherUserId, status: 'active', deletedAt: null },
      select: { id: true },
    });
    if (!teacher) return false;

    const enrollment = await db.enrollment.findFirst({
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
                    some: { teacherProfileId: teacher.id, deletedAt: null },
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

  private async getParentChildren(
    parentUserId: string,
    studentProfileId?: string,
  ) {
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

    return guardians.map((guardian: any) => ({
      ...guardian.studentProfile,
      guardian: {
        id: guardian.id,
        name: guardian.name,
        relationship: guardian.relationship,
        isPrimary: guardian.isPrimary,
      },
    }));
  }

  private async activeClassroomIds(studentProfileId: string) {
    const enrollments = await this.tenantPrisma.client.enrollment.findMany({
      where: { studentProfileId, status: 'active' },
      select: { classroomId: true },
    });
    return enrollments.map((e: any) => e.classroomId);
  }

  // ── Shared lookups, validation, response shaping ──────────────────────────

  private async getAssignment(id: string) {
    const assignment = await this.tenantPrisma.client.assignment.findFirst({
      where: { id, deletedAt: null },
      include: ASSIGNMENT_INCLUDE,
    });
    if (!assignment) throw new NotFoundException(`Assignment ${id} not found`);
    return assignment;
  }

  private validateFile(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException(
        'Unsupported file type — PDF, Office documents, text, images, or ZIP only',
      );
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('File must be under 20 MB');
    }
  }

  private async buildAssignmentSummary(
    assignmentId: string,
    classroomId: string,
  ) {
    const db = this.tenantPrisma.client;
    const [enrolled, submissions] = await Promise.all([
      db.enrollment.count({ where: { classroomId, status: 'active' } }),
      db.assignmentSubmission.findMany({
        where: { assignmentId, deletedAt: null },
        select: { status: true, isLate: true, score: true },
      }),
    ]);
    return this.buildSubmissionSummary(enrolled, submissions);
  }

  private buildSubmissionSummary(
    enrolled: number,
    submissions: Array<{ status: string; isLate: boolean; score: any }>,
  ) {
    const scores = submissions
      .filter((s) => s.score !== null && s.score !== undefined)
      .map((s) => Number(s.score));
    return {
      enrolled,
      submitted: submissions.length,
      late: submissions.filter((s) => s.isLate).length,
      missing: Math.max(0, enrolled - submissions.length),
      graded: submissions.filter((s) => s.status === 'graded').length,
      returned: submissions.filter((s) => s.status === 'returned').length,
      averageScore: scores.length
        ? round2(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null,
    };
  }

  /** Display-state counts for one student's assignment list (powers the frontend tabs). */
  private buildStudentSummary(
    items: Array<{
      status: string;
      dueAt: Date;
      mySubmission: { status: string; score: number | null } | null;
    }>,
  ) {
    const now = new Date();
    let pending = 0;
    let overdue = 0;
    let submitted = 0;
    let graded = 0;
    let returned = 0;
    const scores: number[] = [];

    for (const item of items) {
      const sub = item.mySubmission;
      if (!sub) {
        if (item.status === 'published' && new Date(item.dueAt) >= now)
          pending += 1;
        else overdue += 1;
      } else if (sub.status === 'graded') {
        graded += 1;
        if (sub.score !== null) scores.push(sub.score);
      } else if (sub.status === 'returned') {
        returned += 1;
      } else {
        submitted += 1;
      }
    }

    return {
      total: items.length,
      pending,
      overdue,
      submitted,
      graded,
      returned,
      averageScore: scores.length
        ? round2(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null,
    };
  }

  /** Flattened, PII-trimmed student card (same shape as attendance). */
  private mapStudent(profile: any) {
    return {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.user?.fullName ?? null,
      nisn: profile.nisn ?? null,
      photoUrl: profile.photoUrl ?? null,
      avatarUrl: profile.user?.avatarUrl ?? null,
    };
  }

  private mapAssignment(assignment: any) {
    return {
      id: assignment.id,
      type: assignment.type,
      title: assignment.title,
      description: assignment.description ?? null,
      dueAt: assignment.dueAt,
      maxScore: Number(assignment.maxScore),
      allowLateSubmission: assignment.allowLateSubmission,
      status: assignment.status,
      publishedAt: assignment.publishedAt ?? null,
      closedAt: assignment.closedAt ?? null,
      classroom: assignment.classroom ?? null,
      subject: assignment.subject ?? null,
      academicYear: assignment.academicYear ?? null,
      createdBy: assignment.createdBy ?? null,
      attachments: assignment.attachments ?? [],
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    };
  }

  private mapSubmission(submission: any) {
    return {
      id: submission.id,
      status: submission.status,
      submittedAt: submission.submittedAt,
      isLate: submission.isLate,
      attemptNumber: submission.attemptNumber,
      notes: submission.notes ?? null,
      score:
        submission.score === null || submission.score === undefined
          ? null
          : Number(submission.score),
      feedback: submission.feedback ?? null,
      gradedBy: submission.gradedBy ?? null,
      gradedAt: submission.gradedAt ?? null,
      attachments: submission.attachments ?? [],
    };
  }
}

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory, NotificationPriority, NotificationSourceType } from '../common/enums/notification.enum';
import { paginatedResult } from '../common/utils/paginate';
import { CreateAcademicNoteDto } from './dto/create-academic-note.dto';
import { UpdateAcademicNoteDto } from './dto/update-academic-note.dto';

type ActorContext = { userId: string; role?: string; tenantSlug?: string };

const ADMIN_ROLES = new Set(['school_admin', 'network_admin', 'principal']);
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024;

const NOTE_INCLUDE = {
  studentProfile: {
    select: { id: true, user: { select: { id: true, fullName: true, avatarUrl: true } } },
  },
  teacherProfile: {
    select: { id: true, user: { select: { id: true, fullName: true, avatarUrl: true } } },
  },
  createdBy: { select: { id: true, fullName: true, role: true } },
  subject: { select: { id: true, code: true, name: true } },
  classroom: {
    select: {
      id: true,
      name: true,
      gradeLevel: true,
      academicYearId: true,
      academicYear: { select: { id: true, label: true, semester: true } },
    },
  },
};

@Injectable()
export class AcademicNotesService {
  constructor(
    private readonly tenantPrisma: PrismaTenantService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(filters: {
    studentProfileId?: string;
    teacherProfileId?: string;
    classroomId?: string;
    subjectId?: string;
    year?: number;
    search?: string;
    page?: number;
    limit?: number;
  }, actor: ActorContext) {
    const { studentProfileId, teacherProfileId, classroomId, subjectId, year, search, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where = {
      deletedAt: null,
      ...(studentProfileId ? { studentProfileId } : {}),
      ...(teacherProfileId ? { teacherProfileId } : {}),
      ...(classroomId ? { classroomId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(year ? { noteDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } } : {}),
      ...(search ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { body: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
      ...(await this.visibilityWhere(actor)),
    };

    const [data, total] = await Promise.all([
      this.tenantPrisma.client.academicNote.findMany({ where, include: NOTE_INCLUDE, skip, take: limit, orderBy: [{ noteDate: 'desc' }, { createdAt: 'desc' }] }),
      this.tenantPrisma.client.academicNote.count({ where }),
    ]);
    return paginatedResult(data, total, page, limit);
  }

  async findMine(actor: ActorContext, filters: { page?: number; limit?: number }) {
    return this.findAll({ page: filters.page, limit: filters.limit }, actor);
  }

  async findOne(id: string, actor: ActorContext) {
    const note = await this.tenantPrisma.client.academicNote.findFirst({
      where: { id, deletedAt: null, ...(await this.visibilityWhere(actor)) },
      include: NOTE_INCLUDE,
    });
    if (!note) throw new NotFoundException(`Academic note ${id} not found`);
    return note;
  }

  async create(dto: CreateAcademicNoteDto, actor: ActorContext, file?: Express.Multer.File) {
    const role = await this.getActorRole(actor);
    if (!ADMIN_ROLES.has(role) && role !== 'teacher') {
      throw new ForbiddenException('Only teachers, principal, or admin can create academic notes');
    }

    const studentProfileIds = [...new Set(dto.studentProfileIds)];
    await this.ensureStudentsExist(studentProfileIds);
    const teacherProfileId = role === 'teacher' ? await this.ensureTeacherCanAssign(actor.userId, studentProfileIds, dto.classroomId, dto.subjectId) : undefined;
    if (ADMIN_ROLES.has(role) && dto.classroomId) await this.ensureClassroomStudents(studentProfileIds, dto.classroomId);

    const fileData = file ? await this.uploadFile(file, actor.tenantSlug) : {};
    const notes = await this.tenantPrisma.client.$transaction(
      studentProfileIds.map((studentProfileId) => this.tenantPrisma.client.academicNote.create({
        data: {
          studentProfileId,
          teacherProfileId,
          createdByUserId: actor.userId,
          subjectId: dto.subjectId,
          classroomId: dto.classroomId,
          title: dto.title,
          body: dto.body,
          noteDate: dto.noteDate ? new Date(dto.noteDate) : undefined,
          visibleToGuardian: dto.visibleToGuardian ?? true,
          ...fileData,
        },
        include: NOTE_INCLUDE,
      })),
    );

    await this.notifyRecipients(notes, actor.tenantSlug);
    return notes;
  }

  async update(id: string, dto: UpdateAcademicNoteDto, actor: ActorContext) {
    const note = await this.findNoteForManage(id, actor);
    return this.tenantPrisma.client.academicNote.update({
      where: { id: note.id },
      data: {
        title: dto.title,
        body: dto.body,
        subjectId: dto.subjectId,
        classroomId: dto.classroomId,
        noteDate: dto.noteDate ? new Date(dto.noteDate) : undefined,
        visibleToGuardian: dto.visibleToGuardian,
      },
      include: NOTE_INCLUDE,
    });
  }

  async updateFile(id: string, file: Express.Multer.File, actor: ActorContext) {
    const note = await this.findNoteForManage(id, actor);
    if (note.fileUrl) await this.storage.delete(note.fileUrl);
    const fileData = await this.uploadFile(file, actor.tenantSlug);
    return this.tenantPrisma.client.academicNote.update({ where: { id }, data: fileData, include: NOTE_INCLUDE });
  }

  async removeFile(id: string, actor: ActorContext) {
    const note = await this.findNoteForManage(id, actor);
    if (note.fileUrl) await this.storage.delete(note.fileUrl);
    return this.tenantPrisma.client.academicNote.update({
      where: { id },
      data: { fileUrl: null, fileName: null, mimeType: null, sizeBytes: null },
    });
  }

  async remove(id: string, actor: ActorContext) {
    const note = await this.findNoteForManage(id, actor);
    return this.tenantPrisma.client.academicNote.update({ where: { id: note.id }, data: { deletedAt: new Date() } });
  }

  private async findNoteForManage(id: string, actor: ActorContext) {
    const note = await this.tenantPrisma.client.academicNote.findFirst({ where: { id, deletedAt: null } });
    if (!note) throw new NotFoundException(`Academic note ${id} not found`);

    const role = await this.getActorRole(actor);
    if (ADMIN_ROLES.has(role)) return note;
    if (role === 'teacher' && note.createdByUserId === actor.userId) return note;
    throw new ForbiddenException('You cannot manage this academic note');
  }

  private async visibilityWhere(actor: ActorContext) {
    const role = await this.getActorRole(actor);
    if (ADMIN_ROLES.has(role)) return {};
    if (role === 'student') return { studentProfile: { userId: actor.userId } };
    if (role === 'parent') return { visibleToGuardian: true, studentProfile: { guardians: { some: { userId: actor.userId } } } };
    if (role === 'teacher') {
      const teacher = await this.tenantPrisma.client.teacherProfile.findFirst({ where: { userId: actor.userId, deletedAt: null }, select: { id: true } });
      if (!teacher) throw new ForbiddenException('Teacher profile not found');
      return {
        OR: [
          { createdByUserId: actor.userId },
          { teacherProfileId: teacher.id },
          {
            studentProfile: {
              enrollments: {
                some: {
                  status: 'active' as const,
                  classroom: {
                    OR: [
                      { classSubjects: { some: { teacherProfileId: teacher.id } } },
                      { homeroomAssignments: { some: { teacherProfileId: teacher.id, isActive: true, deletedAt: null } } },
                    ],
                  },
                },
              },
            },
          },
        ],
      };
    }
    throw new ForbiddenException('You cannot view academic notes');
  }

  private async ensureTeacherCanAssign(userId: string, studentProfileIds: string[], classroomId?: string, subjectId?: string) {
    const teacher = await this.tenantPrisma.client.teacherProfile.findFirst({ where: { userId, deletedAt: null, status: 'active' }, select: { id: true } });
    if (!teacher) throw new ForbiddenException('Teacher profile not found');

    if (classroomId) {
      const assignment = await this.tenantPrisma.client.classSubject.findFirst({
        where: { classroomId, teacherProfileId: teacher.id, ...(subjectId ? { subjectId } : {}) },
        select: { id: true },
      });
      const homeroom = await this.tenantPrisma.client.homeroomAssignment.findFirst({ where: { classroomId, teacherProfileId: teacher.id, isActive: true, deletedAt: null }, select: { id: true } });
      if (!assignment && !homeroom) throw new ForbiddenException('Teacher is not assigned to this class');
      await this.ensureClassroomStudents(studentProfileIds, classroomId);
      return teacher.id;
    }

    const count = await this.tenantPrisma.client.studentProfile.count({
      where: {
        id: { in: studentProfileIds },
        enrollments: {
          some: {
            status: 'active' as const,
            classroom: {
              OR: [
                { classSubjects: { some: { teacherProfileId: teacher.id, ...(subjectId ? { subjectId } : {}) } } },
                { homeroomAssignments: { some: { teacherProfileId: teacher.id, isActive: true, deletedAt: null } } },
              ],
            },
          },
        },
      },
    });
    if (count !== studentProfileIds.length) throw new ForbiddenException('Teacher can only assign notes to students in assigned classes');
    return teacher.id;
  }

  private async ensureStudentsExist(studentProfileIds: string[]) {
    const count = await this.tenantPrisma.client.studentProfile.count({ where: { id: { in: studentProfileIds }, status: 'active' } });
    if (count !== studentProfileIds.length) throw new NotFoundException('One or more active student profiles were not found');
  }

  private async ensureClassroomStudents(studentProfileIds: string[], classroomId: string) {
    const count = await this.tenantPrisma.client.enrollment.count({ where: { classroomId, studentProfileId: { in: studentProfileIds }, status: 'active' } });
    if (count !== studentProfileIds.length) throw new BadRequestException('One or more students are not actively enrolled in the selected classroom');
  }

  private async uploadFile(file: Express.Multer.File, tenantSlug?: string) {
    if (!tenantSlug) throw new BadRequestException('Tenant slug is required to upload files');
    if (!ALLOWED_MIME.includes(file.mimetype)) throw new BadRequestException('Only JPEG, PNG, WebP, or PDF files are accepted');
    if (file.size > MAX_BYTES) throw new BadRequestException('File must be under 10 MB');

    const fileUrl = await this.storage.upload(file.buffer, file.originalname, file.mimetype, 'academic-note-files', tenantSlug);
    return { fileUrl, fileName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size };
  }

  private async notifyRecipients(notes: Array<{ id: string; title: string; body: string; studentProfileId: string }>, tenantSlug?: string) {
    if (!tenantSlug) return;
    await Promise.allSettled(notes.map(async (note) => {
      const recipients = await this.resolveRecipientUserIds(note.studentProfileId);
      if (recipients.length === 0) return;
      await this.notifications.createManyAndQueue(recipients.map((userId) => ({
        tenantSlug,
        userId,
        title: `Catatan akademik: ${note.title}`,
        body: note.body,
        data: { academicNoteId: note.id, studentProfileId: note.studentProfileId },
        category: NotificationCategory.academic,
        priority: NotificationPriority.normal,
        eventType: 'academic_note.created',
        sourceType: NotificationSourceType.academic_note,
        sourceId: note.id,
      })));
    }));
  }

  private async resolveRecipientUserIds(studentProfileId: string) {
    const student = await this.tenantPrisma.client.studentProfile.findUnique({
      where: { id: studentProfileId },
      include: { guardians: { where: { userId: { not: null } }, select: { userId: true } } },
    });
    if (!student) return [];
    return [...new Set([student.userId, ...student.guardians.map((guardian) => guardian.userId).filter(Boolean) as string[]])];
  }

  private async getActorRole(actor: ActorContext) {
    if (actor.role) return actor.role;
    const user = await this.tenantPrisma.client.user.findFirst({ where: { id: actor.userId, deletedAt: null, status: 'active' }, select: { role: true } });
    return user?.role ?? '';
  }
}

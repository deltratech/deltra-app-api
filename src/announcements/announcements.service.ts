import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { paginatedResult } from '../common/utils/paginate';
import { getTenantContext } from '../tenant/tenant.context';
import { AnnouncementAudienceType, AnnouncementChannel, AnnouncementStatus, AnnouncementTemplateCategory } from '../common/enums/announcement.enum';
import { NotificationCategory, NotificationPriority, NotificationSourceType } from '../common/enums/notification.enum';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { CreateAnnouncementTemplateDto } from './dto/create-announcement-template.dto';
import { UpdateAnnouncementTemplateDto } from './dto/update-announcement-template.dto';

type ActorContext = { userId: string; role?: string; tenantSlug?: string };
type RecipientInput = {
  studentProfileId: string;
  guardianId?: string;
  userId?: string;
  recipientKey: string;
  name: string;
  phone?: string | null;
  email?: string | null;
};

const BROADCAST_ROLES = new Set(['principal', 'school_admin', 'network_admin']);

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly tenantPrisma: PrismaTenantService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(filters: {
    audienceType?: AnnouncementAudienceType;
    status?: AnnouncementStatus;
    pinned?: boolean;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const { audienceType, status, pinned, page = 1, limit = 20, search } = filters;
    const skip = (page - 1) * limit;
    const where = {
      deletedAt: null,
      ...(audienceType ? { audienceType } : {}),
      ...(status ? { status } : {}),
      ...(typeof pinned === 'boolean' ? { pinned } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { body: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.tenantPrisma.client.announcement.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
        include: {
          attachments: true,
          targetClassroom: { select: { id: true, name: true, gradeLevel: true } },
          createdBy: { select: { id: true, fullName: true, role: true } },
          _count: { select: { recipients: true, deliveryLogs: true } },
        },
      }),
      this.tenantPrisma.client.announcement.count({ where }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const announcement = await this.tenantPrisma.client.announcement.findFirst({
      where: { id, deletedAt: null },
      include: {
        attachments: true,
        targetClassroom: { select: { id: true, name: true, gradeLevel: true } },
        createdBy: { select: { id: true, fullName: true, role: true } },
        recipients: { orderBy: { createdAt: 'asc' } },
        deliveryLogs: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!announcement) throw new NotFoundException(`Announcement ${id} not found`);
    return announcement;
  }

  async create(dto: CreateAnnouncementDto, actor: ActorContext) {
    this.validateTarget(dto);
    await this.ensureCanManage(dto.audienceType, dto.targetClassroomId, actor);

    const status = dto.scheduledAt ? AnnouncementStatus.scheduled : AnnouncementStatus.draft;
    const announcement = await this.tenantPrisma.client.announcement.create({
      data: {
        title: dto.title,
        body: dto.body,
        audienceType: dto.audienceType as any,
        targetGradeLevel: dto.targetGradeLevel,
        targetClassroomId: dto.targetClassroomId,
        channels: dto.channels as any,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        status: status as any,
        createdByUserId: actor.userId,
        attachments: dto.attachments?.length
          ? {
              create: dto.attachments.map((attachment) => ({
                fileUrl: attachment.fileUrl,
                fileName: attachment.fileName,
                mimeType: attachment.mimeType,
                sizeBytes: attachment.sizeBytes,
              })),
            }
          : undefined,
      },
      include: { attachments: true },
    });

    await this.audit(announcement.id, actor.userId, 'created', { status });
    return announcement;
  }

  async update(id: string, dto: UpdateAnnouncementDto, actor: ActorContext) {
    const existing = await this.findOne(id);
    const nextAudienceType = dto.audienceType ?? existing.audienceType;
    const nextClassroomId = dto.targetClassroomId ?? existing.targetClassroomId ?? undefined;

    this.validateTarget({
      audienceType: nextAudienceType as AnnouncementAudienceType,
      targetGradeLevel: dto.targetGradeLevel ?? existing.targetGradeLevel ?? undefined,
      targetClassroomId: nextClassroomId,
    });
    await this.ensureCanUpdate(existing.createdByUserId, nextAudienceType as AnnouncementAudienceType, nextClassroomId, actor);

    const status = dto.scheduledAt ? AnnouncementStatus.scheduled : undefined;
    const updated = await this.tenantPrisma.client.$transaction(async (tx) => {
      if (dto.attachments) {
        await tx.announcementAttachment.deleteMany({ where: { announcementId: id } });
      }

      return tx.announcement.update({
        where: { id },
        data: {
          title: dto.title,
          body: dto.body,
          audienceType: dto.audienceType as any,
          targetGradeLevel: dto.targetGradeLevel,
          targetClassroomId: dto.targetClassroomId,
          channels: dto.channels as any,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
          status: status as any,
          attachments: dto.attachments?.length
            ? {
                create: dto.attachments.map((attachment) => ({
                  fileUrl: attachment.fileUrl,
                  fileName: attachment.fileName,
                  mimeType: attachment.mimeType,
                  sizeBytes: attachment.sizeBytes,
                })),
              }
            : undefined,
        },
        include: { attachments: true },
      });
    });

    await this.audit(id, actor.userId, 'updated', { fields: Object.keys(dto) });
    return updated;
  }

  async remove(id: string, actor: ActorContext) {
    const existing = await this.findOne(id);
    await this.ensureCanUpdate(existing.createdByUserId, existing.audienceType as AnnouncementAudienceType, existing.targetClassroomId ?? undefined, actor);
    const removed = await this.tenantPrisma.client.announcement.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit(id, actor.userId, 'deleted');
    return removed;
  }

  async setPinned(id: string, pinned: boolean, actor: ActorContext) {
    const existing = await this.findOne(id);
    await this.ensureCanUpdate(existing.createdByUserId, existing.audienceType as AnnouncementAudienceType, existing.targetClassroomId ?? undefined, actor);
    const announcement = await this.tenantPrisma.client.announcement.update({ where: { id }, data: { pinned } });
    await this.audit(id, actor.userId, pinned ? 'pinned' : 'unpinned');
    return announcement;
  }

  async send(id: string, actor: ActorContext) {
    const announcement = await this.findOne(id);
    await this.ensureCanUpdate(announcement.createdByUserId, announcement.audienceType as AnnouncementAudienceType, announcement.targetClassroomId ?? undefined, actor);

    const recipients = await this.resolveRecipients(announcement);
    if (recipients.length === 0) throw new BadRequestException('No eligible parent/student recipients found');

    const sent = await this.tenantPrisma.client.$transaction(async (tx) => {
      await tx.announcementRecipient.createMany({ data: recipients.map((recipient) => ({ announcementId: id, ...recipient })), skipDuplicates: true });
      const savedRecipients = await tx.announcementRecipient.findMany({ where: { announcementId: id } });
      const logs = savedRecipients.flatMap((recipient) =>
        (announcement.channels as AnnouncementChannel[]).map((channel) => {
          const destination = this.destinationFor(channel, recipient);
          return {
            announcementId: id,
            recipientId: recipient.id,
            channel: channel as any,
            destination,
            provider: channel === AnnouncementChannel.email ? 'mail_queue' : channel,
            status: (destination ? (channel === AnnouncementChannel.in_app ? 'sent' : 'queued') : 'failed') as any,
            error: destination ? undefined : `Missing ${channel} destination`,
            sentAt: channel === AnnouncementChannel.in_app && destination ? new Date() : undefined,
          };
        }),
      );
      await tx.announcementDeliveryLog.createMany({ data: logs, skipDuplicates: true });
      return tx.announcement.update({ where: { id }, data: { status: AnnouncementStatus.sent as any, sentAt: new Date() } });
    });

    await this.queueEmailDeliveries(id, announcement.title, announcement.body);
    await this.queueInAppNotifications(id, announcement.title, announcement.body, actor.tenantSlug ?? getTenantContext().tenantSlug);
    await this.audit(id, actor.userId, 'sent', { recipientCount: recipients.length, channels: announcement.channels });
    return sent;
  }

  async sendDueScheduled(actor: ActorContext) {
    if (!BROADCAST_ROLES.has(actor.role ?? '')) {
      throw new ForbiddenException('Only principal/admin can dispatch scheduled announcements');
    }

    const due = await this.tenantPrisma.client.announcement.findMany({
      where: {
        deletedAt: null,
        status: AnnouncementStatus.scheduled as any,
        scheduledAt: { lte: new Date() },
      },
      select: { id: true },
      orderBy: { scheduledAt: 'asc' },
    });

    const results = [] as Array<{ id: string; sent: boolean; error?: string }>;
    for (const announcement of due) {
      try {
        await this.send(announcement.id, actor);
        results.push({ id: announcement.id, sent: true });
      } catch (error) {
        results.push({ id: announcement.id, sent: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return { count: results.filter((result) => result.sent).length, results };
  }

  async markRead(id: string, recipientId: string) {
    await this.findOne(id);
    const recipient = await this.tenantPrisma.client.announcementRecipient.findFirst({ where: { id: recipientId, announcementId: id } });
    if (!recipient) throw new NotFoundException(`Announcement recipient ${recipientId} not found`);
    return this.tenantPrisma.client.announcementRecipient.update({ where: { id: recipientId }, data: { readAt: recipient.readAt ?? new Date() } });
  }

  findDeliveryLogs(id: string) {
    return this.tenantPrisma.client.announcementDeliveryLog.findMany({
      where: { announcementId: id },
      include: { recipient: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  findAuditLogs(id: string) {
    return this.tenantPrisma.client.announcementAuditLog.findMany({
      where: { announcementId: id },
      include: { actor: { select: { id: true, fullName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findTemplates(category?: AnnouncementTemplateCategory) {
    return this.tenantPrisma.client.announcementTemplate.findMany({
      where: { deletedAt: null, isActive: true, ...(category ? { category: category as any } : {}) },
      orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
    });
  }

  createTemplate(dto: CreateAnnouncementTemplateDto) {
    return this.tenantPrisma.client.announcementTemplate.create({ data: dto as any });
  }

  async updateTemplate(id: string, dto: UpdateAnnouncementTemplateDto) {
    await this.findTemplateOrThrow(id);
    return this.tenantPrisma.client.announcementTemplate.update({ where: { id }, data: dto as any });
  }

  async removeTemplate(id: string) {
    await this.findTemplateOrThrow(id);
    return this.tenantPrisma.client.announcementTemplate.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  private validateTarget(dto: { audienceType: AnnouncementAudienceType; targetGradeLevel?: number | null; targetClassroomId?: string | null }) {
    if (dto.audienceType === AnnouncementAudienceType.grade && !dto.targetGradeLevel) {
      throw new BadRequestException('targetGradeLevel is required for grade-wide announcements');
    }
    if (dto.audienceType === AnnouncementAudienceType.class && !dto.targetClassroomId) {
      throw new BadRequestException('targetClassroomId is required for class-wide announcements');
    }
    if (dto.audienceType === AnnouncementAudienceType.school && (dto.targetGradeLevel || dto.targetClassroomId)) {
      throw new BadRequestException('School-wide announcements cannot include grade or classroom targets');
    }
  }

  private async ensureCanUpdate(createdByUserId: string, audienceType: AnnouncementAudienceType, classroomId: string | undefined, actor: ActorContext) {
    if (BROADCAST_ROLES.has(actor.role ?? '')) return;
    if (createdByUserId !== actor.userId) throw new ForbiddenException('You can only update announcements you created');
    await this.ensureCanManage(audienceType, classroomId, actor);
  }

  private async ensureCanManage(audienceType: AnnouncementAudienceType, classroomId: string | undefined, actor: ActorContext) {
    if (BROADCAST_ROLES.has(actor.role ?? '')) return;
    if (actor.role !== 'teacher') throw new ForbiddenException('Only principal/admin or allowed teachers can manage announcements');
    if (audienceType !== AnnouncementAudienceType.class || !classroomId) {
      throw new ForbiddenException('Teachers can only send class announcements');
    }
    const teacher = await this.tenantPrisma.client.teacherProfile.findFirst({
      where: { userId: actor.userId, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) throw new ForbiddenException('Teacher profile not found');
    const assignment = await this.tenantPrisma.client.classSubject.findFirst({
      where: { classroomId, teacherProfileId: teacher.id },
      select: { id: true },
    });
    const homeroom = await this.tenantPrisma.client.homeroomAssignment.findFirst({
      where: { classroomId, teacherProfileId: teacher.id, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!assignment && !homeroom) throw new ForbiddenException('Teacher is not assigned to this class');
  }

  private async resolveRecipients(announcement: any): Promise<RecipientInput[]> {
    const where = {
      status: 'active' as const,
      classroom: {
        deletedAt: null,
        ...(announcement.audienceType === AnnouncementAudienceType.grade ? { gradeLevel: announcement.targetGradeLevel } : {}),
        ...(announcement.audienceType === AnnouncementAudienceType.class ? { id: announcement.targetClassroomId } : {}),
      },
      studentProfile: { status: 'active' as const },
    };

    const enrollments = await this.tenantPrisma.client.enrollment.findMany({
      where,
      include: {
        studentProfile: {
          include: {
            user: { select: { fullName: true, phone: true, email: true } },
            guardians: true,
          },
        },
      },
    });

    const recipients = new Map<string, RecipientInput>();
    for (const enrollment of enrollments) {
      const student = enrollment.studentProfile;
      if (student.guardians.length === 0) {
        recipients.set(`student:${student.id}`, {
          studentProfileId: student.id,
          userId: student.userId,
          recipientKey: `student:${student.id}`,
          name: student.user.fullName,
          phone: student.phone ?? student.user.phone,
          email: student.user.email,
        });
        continue;
      }

      for (const guardian of student.guardians) {
        const key = `guardian:${guardian.id}`;
        recipients.set(key, {
          studentProfileId: student.id,
          guardianId: guardian.id,
          userId: guardian.userId ?? undefined,
          recipientKey: key,
          name: guardian.name,
          phone: guardian.phone,
          email: guardian.email,
        });
      }
    }
    return [...recipients.values()];
  }

  private destinationFor(channel: AnnouncementChannel, recipient: { userId?: string | null; phone?: string | null; email?: string | null }) {
    if (channel === AnnouncementChannel.in_app) return recipient.userId ?? undefined;
    if (channel === AnnouncementChannel.email) return recipient.email ?? undefined;
    if (channel === AnnouncementChannel.whatsapp) return recipient.phone ?? undefined;
    return undefined;
  }

  private async queueInAppNotifications(announcementId: string, title: string, body: string, tenantSlug?: string) {
    if (!tenantSlug) return;
    const recipients = await this.tenantPrisma.client.announcementRecipient.findMany({
      where: {
        announcementId,
        userId: { not: null },
        deliveryLogs: { some: { channel: AnnouncementChannel.in_app as any, status: 'sent' as any } },
      },
      select: { userId: true },
    });

    const userIds = [...new Set(recipients.map((recipient) => recipient.userId).filter((userId): userId is string => Boolean(userId)))];
    const existing = await this.tenantPrisma.client.notification.findMany({
      where: { announcementId, userId: { in: userIds } },
      select: { userId: true },
    });
    const existingUserIds = new Set(existing.map((notification) => notification.userId));
    await this.notifications.createManyAndQueue(
      userIds.filter((userId) => !existingUserIds.has(userId)).map((userId) => ({
        tenantSlug,
        userId,
        title,
        body,
        announcementId,
        category: NotificationCategory.announcement,
        eventType: 'announcement_sent',
        priority: NotificationPriority.normal,
        sourceType: NotificationSourceType.announcement,
        sourceId: announcementId,
        data: { type: 'announcement', announcementId },
      })),
    );
  }

  private async queueEmailDeliveries(announcementId: string, title: string, body: string) {
    const logs = await this.tenantPrisma.client.announcementDeliveryLog.findMany({
      where: { announcementId, channel: AnnouncementChannel.email as any, status: 'queued' as any, destination: { not: null } },
    });
    await Promise.all(logs.map((log) => this.mail.sendAnnouncement(log.destination!, title, this.toHtml(body))));
  }

  private toHtml(body: string) {
    return body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  }

  private async findTemplateOrThrow(id: string) {
    const template = await this.tenantPrisma.client.announcementTemplate.findFirst({ where: { id, deletedAt: null } });
    if (!template) throw new NotFoundException(`Announcement template ${id} not found`);
    return template;
  }

  private audit(announcementId: string | null, actorUserId: string, action: string, metadata?: Record<string, unknown>) {
    return this.tenantPrisma.client.announcementAuditLog.create({
      data: { announcementId, actorUserId, action, metadata: metadata as any },
    });
  }
}

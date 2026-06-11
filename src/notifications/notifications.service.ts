import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { paginatedResult } from '../common/utils/paginate';
import { getTenantContext } from '../tenant/tenant.context';
import { NotificationCategory, NotificationPriority, NotificationSourceType } from '../common/enums/notification.enum';
import { RegisterPushDeviceDto } from './dto/register-push-device.dto';

export const PUSH_NOTIFICATIONS_QUEUE = 'push-notifications';
export const SEND_PUSH_NOTIFICATION_JOB = 'send-push-notification';

export type PushNotificationJob = {
  tenantSlug: string;
  eventId: string;
  recipientIds: string[];
};

export type CreateNotificationInput = {
  tenantSlug: string;
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  announcementId?: string;
  category?: NotificationCategory;
  eventType: string;
  priority?: NotificationPriority;
  sourceType?: NotificationSourceType;
  sourceId?: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly tenantPrisma: PrismaTenantService,
    private readonly config: ConfigService,
    @InjectQueue(PUSH_NOTIFICATIONS_QUEUE) private readonly queue: Queue<PushNotificationJob>,
  ) {}

  async registerDevice(userId: string, dto: RegisterPushDeviceDto) {
    await this.ensureTenantUser(userId);
    return this.tenantPrisma.client.pushDeviceToken.upsert({
      where: { token: dto.token },
      update: {
        userId,
        platform: (dto.platform ?? 'web') as any,
        userAgent: dto.userAgent,
        revokedAt: null,
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        token: dto.token,
        platform: (dto.platform ?? 'web') as any,
        userAgent: dto.userAgent,
      },
    });
  }

  async revokeDevice(userId: string, id: string) {
    await this.ensureTenantUser(userId);
    const token = await this.tenantPrisma.client.pushDeviceToken.findFirst({ where: { id, userId, revokedAt: null } });
    if (!token) throw new NotFoundException(`Push device ${id} not found`);
    return this.tenantPrisma.client.pushDeviceToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  async findMyDevices(userId: string) {
    await this.ensureTenantUser(userId);
    return this.tenantPrisma.client.pushDeviceToken.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async findMine(userId: string, filters: { unreadOnly?: boolean; category?: NotificationCategory; priority?: NotificationPriority; page?: number; limit?: number }) {
    await this.ensureTenantUser(userId);
    const { unreadOnly, category, priority, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const eventWhere = {
      ...(category ? { category } : {}),
      ...(priority ? { priority } : {}),
    };
    const where = {
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
      ...(category || priority ? { event: eventWhere } : {}),
    };
    const [data, total] = await Promise.all([
      this.tenantPrisma.client.notificationRecipient.findMany({
        where,
        include: { event: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.tenantPrisma.client.notificationRecipient.count({ where }),
    ]);
    return paginatedResult(data.map((r) => this.toApiNotification(r)), total, page, limit);
  }

  /** Flatten a recipient+event row into the flat notification shape the clients expect. */
  private toApiNotification(r: { id: string; readAt: Date | null; createdAt: Date; event: any }) {
    const e = r.event ?? {};
    const data = (e.data && typeof e.data === 'object') ? e.data as Record<string, unknown> : {};
    return {
      id: r.id,
      title: e.title ?? '',
      body: e.body ?? '',
      message: e.body ?? '',
      category: e.category,
      priority: e.priority,
      eventType: e.eventType,
      sourceType: e.sourceType ?? null,
      sourceId: e.sourceId ?? null,
      isRead: r.readAt != null,
      createdAt: r.createdAt,
      actionUrl: typeof data.pageId === 'string' ? data.pageId : null,
      data,
    };
  }

  async markRead(userId: string, id: string) {
    await this.ensureTenantUser(userId);
    const recipient = await this.tenantPrisma.client.notificationRecipient.findFirst({ where: { id, userId } });
    if (!recipient) throw new NotFoundException(`Notification ${id} not found`);
    return this.tenantPrisma.client.notificationRecipient.update({
      where: { id },
      data: { readAt: recipient.readAt ?? new Date() },
      include: { event: true },
    });
  }

  async createAndQueue(input: CreateNotificationInput) {
    const [recipient] = await this.createManyAndQueue([input]);
    return recipient;
  }

  async createManyAndQueue(inputs: CreateNotificationInput[]) {
    if (inputs.length === 0) return [];

    const [first] = inputs;
    const userIds = [...new Set(inputs.map((input) => input.userId))];
    await Promise.all(userIds.map((userId) => this.ensureTenantUser(userId)));

    const eventData = {
      announcementId: first.announcementId,
      category: (first.category ?? NotificationCategory.system) as any,
      eventType: first.eventType,
      priority: (first.priority ?? NotificationPriority.normal) as any,
      sourceType: first.sourceType as any,
      sourceId: first.sourceId,
      title: first.title,
      body: first.body,
      data: first.data as any,
    };

    const event = first.sourceType && first.sourceId
      ? await this.tenantPrisma.client.notificationEvent.upsert({
          where: {
            eventType_sourceType_sourceId: {
              eventType: first.eventType,
              sourceType: first.sourceType as any,
              sourceId: first.sourceId,
            },
          },
          update: eventData,
          create: eventData,
        })
      : await this.tenantPrisma.client.notificationEvent.create({ data: eventData });

    await this.tenantPrisma.client.notificationRecipient.createMany({
      data: userIds.map((userId) => ({ eventId: event.id, userId })),
      skipDuplicates: true,
    });

    const recipients = await this.tenantPrisma.client.notificationRecipient.findMany({
      where: { eventId: event.id, userId: { in: userIds } },
      include: { event: true },
    });

    for (const recipientIds of this.chunk(recipients.map((recipient) => recipient.id), this.chunkSize())) {
      await this.queue.add(SEND_PUSH_NOTIFICATION_JOB, {
        tenantSlug: first.tenantSlug,
        eventId: event.id,
        recipientIds,
      });
    }

    return recipients;
  }

  async sendTest(user: { userId: string; tenantSlug?: string }, input: {
    title: string;
    body: string;
    data?: Record<string, string>;
    category?: NotificationCategory;
    eventType?: string;
    priority?: NotificationPriority;
    sourceType?: NotificationSourceType;
    sourceId?: string;
  }) {
    const tenantSlug = user.tenantSlug ?? getTenantContext().tenantSlug;
    return this.createAndQueue({
      tenantSlug,
      userId: user.userId,
      title: input.title,
      body: input.body,
      data: input.data,
      eventType: input.eventType ?? 'test',
      category: input.category ?? NotificationCategory.system,
      priority: input.priority ?? NotificationPriority.normal,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    });
  }

  private async ensureTenantUser(userId: string) {
    const user = await this.tenantPrisma.client.user.findFirst({
      where: { id: userId, status: 'active', deletedAt: null },
      select: { id: true },
    });
    if (!user) {
      throw new ForbiddenException('Authenticated user does not belong to the current tenant');
    }
  }

  private chunkSize() {
    const value = this.config.get<number>('NOTIFICATION_PUSH_CHUNK_SIZE', 500);
    return Number.isFinite(value) && value > 0 ? value : 500;
  }

  private chunk<T>(items: T[], size: number) {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }
    return chunks;
  }
}

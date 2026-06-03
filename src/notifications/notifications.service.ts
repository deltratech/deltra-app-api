import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { paginatedResult } from '../common/utils/paginate';
import { getTenantContext } from '../tenant/tenant.context';
import { RegisterPushDeviceDto } from './dto/register-push-device.dto';

export const PUSH_NOTIFICATIONS_QUEUE = 'push-notifications';
export const SEND_PUSH_NOTIFICATION_JOB = 'send-push-notification';

export type PushNotificationJob = {
  tenantSlug: string;
  notificationId: string;
};

export type CreateNotificationInput = {
  tenantSlug: string;
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  announcementId?: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly tenantPrisma: PrismaTenantService,
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

  async findMine(userId: string, filters: { unreadOnly?: boolean; page?: number; limit?: number }) {
    await this.ensureTenantUser(userId);
    const { unreadOnly, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where = {
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
    };
    const [data, total] = await Promise.all([
      this.tenantPrisma.client.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.tenantPrisma.client.notification.count({ where }),
    ]);
    return paginatedResult(data, total, page, limit);
  }

  async markRead(userId: string, id: string) {
    await this.ensureTenantUser(userId);
    const notification = await this.tenantPrisma.client.notification.findFirst({ where: { id, userId } });
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);
    return this.tenantPrisma.client.notification.update({ where: { id }, data: { readAt: notification.readAt ?? new Date() } });
  }

  async createAndQueue(input: CreateNotificationInput) {
    await this.ensureTenantUser(input.userId);
    const notification = await this.tenantPrisma.client.notification.create({
      data: {
        userId: input.userId,
        announcementId: input.announcementId,
        title: input.title,
        body: input.body,
        data: input.data as any,
      },
    });

    await this.queue.add(SEND_PUSH_NOTIFICATION_JOB, {
      tenantSlug: input.tenantSlug,
      notificationId: notification.id,
    });

    return notification;
  }

  async createManyAndQueue(inputs: CreateNotificationInput[]) {
    const notifications = [] as Awaited<ReturnType<typeof this.createAndQueue>>[];
    for (const input of inputs) {
      notifications.push(await this.createAndQueue(input));
    }
    return notifications;
  }

  async sendTest(user: { userId: string; tenantSlug?: string }, input: { title: string; body: string; data?: Record<string, string> }) {
    const tenantSlug = user.tenantSlug ?? getTenantContext().tenantSlug;
    return this.createAndQueue({
      tenantSlug,
      userId: user.userId,
      title: input.title,
      body: input.body,
      data: input.data,
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
}

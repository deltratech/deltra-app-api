import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaTenantService } from '../../prisma/prisma-tenant.service';
import { toSchemaName } from '../../tenant/tenant.utils';
import { FcmService } from '../fcm.service';
import { PUSH_NOTIFICATIONS_QUEUE, PushNotificationJob } from '../notifications.service';

@Processor(PUSH_NOTIFICATIONS_QUEUE)
export class SendPushNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(SendPushNotificationProcessor.name);

  constructor(
    private readonly tenantPrisma: PrismaTenantService,
    private readonly fcm: FcmService,
  ) {
    super();
  }

  async process(job: Job<PushNotificationJob>): Promise<void> {
    const db = this.tenantPrisma.forSchema(toSchemaName(job.data.tenantSlug));
    const notification = await db.notification.findUnique({ where: { id: job.data.notificationId } });
    if (!notification) return;

    const tokens = await db.pushDeviceToken.findMany({
      where: { userId: notification.userId, revokedAt: null },
    });

    for (const token of tokens) {
      const log = await db.notificationDeliveryLog.upsert({
        where: {
          notificationId_pushDeviceTokenId: {
            notificationId: notification.id,
            pushDeviceTokenId: token.id,
          },
        },
        update: { status: 'queued' as any, error: null },
        create: {
          notificationId: notification.id,
          pushDeviceTokenId: token.id,
          status: 'queued' as any,
        },
      });

      try {
        const providerMessageId = await this.fcm.send({
          token: token.token,
          title: notification.title,
          body: notification.body,
          data: this.toStringData(notification.data),
        });
        await db.notificationDeliveryLog.update({
          where: { id: log.id },
          data: { status: 'sent' as any, providerMessageId, sentAt: new Date(), error: null },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await db.notificationDeliveryLog.update({
          where: { id: log.id },
          data: { status: 'failed' as any, error: message },
        });
        if (message.includes('registration-token-not-registered') || message.includes('invalid-registration-token')) {
          await db.pushDeviceToken.update({ where: { id: token.id }, data: { revokedAt: new Date() } });
        }
        this.logger.warn(`Failed to send push notification ${notification.id} to token ${token.id}: ${message}`);
      }
    }
  }

  private toStringData(data: unknown): Record<string, string> | undefined {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
    return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)]));
  }
}

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
    const recipients = await db.notificationRecipient.findMany({
      where: { id: { in: job.data.recipientIds }, eventId: job.data.eventId },
      include: { event: true },
    });
    if (recipients.length === 0) return;

    const tokens = await db.pushDeviceToken.findMany({
      where: { userId: { in: recipients.map((recipient) => recipient.userId) }, revokedAt: null },
    });

    const tokensByUserId = new Map<string, typeof tokens>();
    for (const token of tokens) {
      const userTokens = tokensByUserId.get(token.userId) ?? [];
      userTokens.push(token);
      tokensByUserId.set(token.userId, userTokens);
    }

    for (const recipient of recipients) {
      for (const token of tokensByUserId.get(recipient.userId) ?? []) {
        const log = await db.notificationDeliveryLog.upsert({
          where: {
            recipientId_pushDeviceTokenId: {
              recipientId: recipient.id,
              pushDeviceTokenId: token.id,
            },
          },
          update: { status: 'queued' as any, error: null },
          create: {
            recipientId: recipient.id,
            pushDeviceTokenId: token.id,
            status: 'queued' as any,
          },
        });

        try {
          const providerMessageId = await this.fcm.send({
            token: token.token,
            title: recipient.event.title,
            body: recipient.event.body,
            data: this.toStringData(recipient.event.data),
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
          this.logger.warn(`Failed to send push notification recipient ${recipient.id} to token ${token.id}: ${message}`);
        }
      }
    }
  }

  private toStringData(data: unknown): Record<string, string> | undefined {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
    return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)]));
  }
}

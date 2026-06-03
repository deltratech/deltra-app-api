import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FcmService } from './fcm.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService, PUSH_NOTIFICATIONS_QUEUE } from './notifications.service';
import { SendPushNotificationProcessor } from './processors/send-push-notification.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: PUSH_NOTIFICATIONS_QUEUE }),
    BullBoardModule.forFeature({ name: PUSH_NOTIFICATIONS_QUEUE, adapter: BullMQAdapter }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, FcmService, SendPushNotificationProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}

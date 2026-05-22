import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { MailService, MAIL_QUEUE } from './mail.service';
import { SendMailProcessor } from './processors/send-mail.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: MAIL_QUEUE }),
    BullBoardModule.forFeature({ name: MAIL_QUEUE, adapter: BullMQAdapter }),
  ],
  providers: [MailService, SendMailProcessor],
  exports: [MailService],
})
export class MailModule {}

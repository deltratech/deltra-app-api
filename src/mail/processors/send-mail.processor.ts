import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { MAIL_QUEUE, SendMailOptions } from '../mail.service';

@Processor(MAIL_QUEUE)
export class SendMailProcessor extends WorkerHost {
  private readonly logger = new Logger(SendMailProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    super();
    this.transporter = nodemailer.createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port: config.get<number>('SMTP_PORT', 587),
      secure: config.get<boolean>('SMTP_SECURE', false),
      auth: {
        user: config.getOrThrow<string>('SMTP_USER'),
        pass: config.getOrThrow<string>('SMTP_PASS'),
      },
    });
  }

  async process(job: Job<SendMailOptions>): Promise<void> {
    const { to, subject, html } = job.data;
    try {
      await this.transporter.sendMail({
        from: this.config.get<string>('SMTP_FROM') ?? this.config.get<string>('SMTP_USER'),
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}`, err);
      throw err; // BullMQ will retry
    }
  }
}

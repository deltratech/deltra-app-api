import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

export const MAIL_QUEUE = 'mail';
export const SEND_MAIL_JOB = 'send-mail';

@Injectable()
export class MailService {
  constructor(@InjectQueue(MAIL_QUEUE) private readonly queue: Queue) {}

  async sendOtp(to: string, otp: string, tenantName: string): Promise<void> {
    await this.queue.add(SEND_MAIL_JOB, {
      to,
      subject: `Kode Reset Password — ${tenantName}`,
      html: `
        <p>Halo,</p>
        <p>Gunakan kode berikut untuk mereset password kamu di <strong>${tenantName}</strong>:</p>
        <h2 style="letter-spacing:4px">${otp}</h2>
        <p>Kode berlaku selama <strong>10 menit</strong>. Jangan bagikan kode ini kepada siapapun.</p>
        <p>Jika kamu tidak merasa meminta reset password, abaikan email ini.</p>
      `,
    } satisfies SendMailOptions);
  }

  async sendAnnouncement(to: string, subject: string, html: string): Promise<void> {
    await this.queue.add(SEND_MAIL_JOB, { to, subject, html } satisfies SendMailOptions);
  }
}

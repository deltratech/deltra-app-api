import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const OTP_TTL_SECONDS = 10 * 60;      // 10 minutes
const OTP_MAX_ATTEMPTS = 5;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 7 days

interface RefreshPayload {
  userId: string;
  tenantId?: string;
  tenantSlug?: string;
  isSuperAdmin?: boolean;
  isPlatformUser?: boolean;
  role?: string;
  networkId?: string;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  // ── OTP ─────────────────────────────────────────────────────────────────────

  async saveOtp(tenantSlug: string, email: string, otp: string): Promise<void> {
    const key = this.otpKey(tenantSlug, email);
    await this.client.set(key, otp, 'EX', OTP_TTL_SECONDS);
    await this.client.del(this.attemptsKey(tenantSlug, email));
  }

  async verifyOtp(tenantSlug: string, email: string, otp: string): Promise<boolean> {
    const attKey = this.attemptsKey(tenantSlug, email);
    const attempts = await this.client.incr(attKey);
    await this.client.expire(attKey, OTP_TTL_SECONDS);

    if (attempts > OTP_MAX_ATTEMPTS) return false;

    const stored = await this.client.get(this.otpKey(tenantSlug, email));
    if (stored !== otp) return false;

    // OTP is single-use — delete after successful verification
    await this.client.del(this.otpKey(tenantSlug, email));
    await this.client.del(attKey);
    return true;
  }

  private otpKey(tenantSlug: string, email: string): string {
    return `otp:${tenantSlug}:${email.toLowerCase()}`;
  }

  private attemptsKey(tenantSlug: string, email: string): string {
    return `otp_attempts:${tenantSlug}:${email.toLowerCase()}`;
  }

  // ── Refresh Token ────────────────────────────────────────────────────────────

  async saveRefreshToken(token: string, payload: RefreshPayload): Promise<void> {
    await this.client.set(
      `rt:${token}`,
      JSON.stringify(payload),
      'EX',
      REFRESH_TTL_SECONDS,
    );
  }

  async getRefreshToken(token: string): Promise<RefreshPayload | null> {
    const data = await this.client.get(`rt:${token}`);
    if (!data) return null;
    return JSON.parse(data) as RefreshPayload;
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await this.client.del(`rt:${token}`);
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { toSchemaName } from '../tenant/tenant.utils';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  phone: true,
  avatarUrl: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: PrismaTenantService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug: dto.tenantSlug, deletedAt: null },
    });
    if (!tenant) throw new NotFoundException(`Tenant '${dto.tenantSlug}' not found`);
    if (tenant.status === 'suspended')
      throw new UnauthorizedException(`Tenant '${dto.tenantSlug}' is suspended`);

    const db = this.tenantPrisma.forSchema(toSchemaName(dto.tenantSlug));

    const user = await db.user.findFirst({
      where: {
        OR: [{ email: dto.identifier }, { username: dto.identifier }],
        deletedAt: null,
        status: 'active',
      },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (!user.passwordHash)
      throw new UnauthorizedException('This account uses SSO — password login is disabled');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = this.signToken(user.id, tenant.id, tenant.slug);
    const refreshToken = await this.generateRefreshToken(user.id, tenant.id, tenant.slug);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
      },
    };
  }

  async refresh(refreshToken: string) {
    const payload = await this.redis.getRefreshToken(refreshToken);
    if (!payload) throw new UnauthorizedException('Invalid or expired refresh token');

    // Rotate: invalidate old token and issue a new pair
    await this.redis.deleteRefreshToken(refreshToken);
    const newAccessToken = this.signToken(payload.userId, payload.tenantId, payload.tenantSlug);
    const newRefreshToken = await this.generateRefreshToken(
      payload.userId,
      payload.tenantId,
      payload.tenantSlug,
    );

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string) {
    await this.redis.deleteRefreshToken(refreshToken);
    return { message: 'Logged out successfully.' };
  }

  async register(dto: RegisterDto, tenantSlug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug: tenantSlug, deletedAt: null },
    });
    if (!tenant) throw new NotFoundException(`Tenant '${tenantSlug}' not found`);

    const db = this.tenantPrisma.forSchema(toSchemaName(tenantSlug));

    if (dto.email) {
      const exists = await db.user.findUnique({ where: { email: dto.email } });
      if (exists) throw new ConflictException(`Email '${dto.email}' is already registered`);
    }
    if (dto.username) {
      const exists = await db.user.findUnique({ where: { username: dto.username } });
      if (exists) throw new ConflictException(`Username '${dto.username}' is already taken`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await db.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        fullName: dto.fullName,
        phone: dto.phone,
        avatarUrl: dto.avatarUrl,
        passwordHash,
        role: dto.role,
      },
      select: SAFE_USER_SELECT,
    });

    return {
      accessToken: this.signToken(user.id, tenant.id, tenant.slug),
      user,
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
      },
    };
  }

  async me(userId: string, tenantSlug: string) {
    const db = this.tenantPrisma.forSchema(toSchemaName(tenantSlug));
    const user = await db.user.findFirst({
      where: { id: userId, deletedAt: null, status: 'active' },
      select: SAFE_USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ── Forgot Password ──────────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug: dto.tenantSlug, deletedAt: null },
    });
    if (!tenant) throw new NotFoundException(`Tenant '${dto.tenantSlug}' not found`);

    const db = this.tenantPrisma.forSchema(toSchemaName(dto.tenantSlug));
    const user = await db.user.findFirst({
      where: { email: dto.email, deletedAt: null, status: 'active' },
    });

    // Always return success to avoid email enumeration
    if (!user) return { message: 'If that email exists, an OTP has been sent.' };

    const otp = this.generateOtp();
    await this.redis.saveOtp(dto.tenantSlug, dto.email, otp);
    await this.mail.sendOtp(dto.email, otp, tenant.name);

    return { message: 'If that email exists, an OTP has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const valid = await this.redis.verifyOtp(dto.tenantSlug, dto.email, dto.otp);
    if (!valid) throw new BadRequestException('Invalid or expired OTP');

    const db = this.tenantPrisma.forSchema(toSchemaName(dto.tenantSlug));
    const user = await db.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return { message: 'Password reset successful.' };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private generateOtp(): string {
    return Math.floor(100_000 + Math.random() * 900_000).toString();
  }

  private signToken(userId: string, tenantId: string, tenantSlug: string): string {
    const payload: JwtPayload = { sub: userId, tenantId, tenantSlug };
    return this.jwt.sign(payload);
  }

  private async generateRefreshToken(
    userId: string,
    tenantId: string,
    tenantSlug: string,
  ): Promise<string> {
    const token = randomBytes(40).toString('hex');
    await this.redis.saveRefreshToken(token, { userId, tenantId, tenantSlug });
    return token;
  }
}

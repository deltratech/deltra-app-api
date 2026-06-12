import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { CreateSuperadminDto } from './dto/create-superadmin.dto';

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

const SCHOOL_SELECT = {
  id: true,
  name: true,
  slug: true,
  type: true,
  status: true,
  parentId: true,
  createdAt: true,
  updatedAt: true,
  settings: true,
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
    if (!dto.tenantSlug) return this.loginAsPlatformUser(dto);
    return this.loginAsTenant(dto as LoginDto & { tenantSlug: string });
  }

  async createSuperadmin(dto: CreateSuperadminDto) {
    const exists = await this.prisma.platformUser.findFirst({
      where: {
        OR: [
          { email: dto.email },
          ...(dto.username ? [{ username: dto.username }] : []),
        ],
        deletedAt: null,
      },
    });
    if (exists) throw new ConflictException('Platform user with this email or username already exists');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.platformUser.create({
      data: {
        email: dto.email,
        username: dto.username,
        fullName: dto.fullName,
        passwordHash,
        role: 'superadmin',
        status: 'active',
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    return user;
  }

  /**
   * Authenticate a platform user (superadmin or network_admin) — they live in
   * `public.platform_users`, not in any tenant schema. When `expectedNetworkId`
   * is given (login arrived via a network's slug/subdomain) the user must belong
   * to that network — unless they're a superadmin, who may log in anywhere.
   */
  private async loginAsPlatformUser(dto: LoginDto, expectedNetworkId?: string) {
    const user = await this.prisma.platformUser.findFirst({
      where: {
        OR: [{ email: dto.identifier }, { username: dto.identifier }],
        status: 'active',
        deletedAt: null,
      },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (expectedNetworkId && user.role !== 'superadmin'
      && (user as typeof user & { networkId?: string | null }).networkId !== expectedNetworkId) {
      throw new UnauthorizedException('This account does not belong to this network');
    }

    await this.prisma.platformUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const platformUser = user as typeof user & { networkId?: string | null };
    const isSuperAdmin = platformUser.role === 'superadmin';
    const accessToken = this.signPlatformToken(platformUser.id, platformUser.role, platformUser.networkId, isSuperAdmin);
    const refreshToken = await this.generateRefreshToken(
      platformUser.id,
      undefined,
      undefined,
      isSuperAdmin,
      true,
      platformUser.role,
      platformUser.networkId,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: platformUser.id,
        email: platformUser.email,
        username: platformUser.username,
        fullName: platformUser.fullName,
        role: platformUser.role,
        networkId: platformUser.networkId,
        status: platformUser.status,
      },
    };
  }

  private async loginAsTenant(dto: LoginDto & { tenantSlug: string }) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug: dto.tenantSlug, deletedAt: null },
    });
    if (!tenant) throw new NotFoundException(`Tenant '${dto.tenantSlug}' not found`);
    if ((tenant as typeof tenant & { status?: string }).status === 'suspended')
      throw new UnauthorizedException(`Tenant '${dto.tenantSlug}' is suspended`);

    // A network/foundation has no schema of its own — its slug/subdomain is an
    // entry point for that network's admin, who lives in public.platform_users.
    if ((tenant as typeof tenant & { type?: string }).type === 'network') {
      return this.loginAsPlatformUser(dto, tenant.id);
    }

    const db = this.tenantPrisma.forSchema(toSchemaName(dto.tenantSlug));

    const user = await db.user.findFirst({
      where: {
        OR: [{ email: dto.identifier }, { username: dto.identifier }],
        deletedAt: null,
        status: 'active',
      },
    });
    // No school-schema user with this identifier — a network admin (or superadmin)
    // may be signing in at one of their child-school slugs (they live in public.platform_users).
    if (!user) return this.loginNetworkAdminIntoSchool(dto, tenant);

    if (!user.passwordHash)
      throw new UnauthorizedException('This account uses SSO — password login is disabled');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = this.signToken(user.id, tenant.id, tenant.slug, user.role);
    const refreshToken = await this.generateRefreshToken(user.id, tenant.id, tenant.slug, false, false, user.role);

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

  /** A network admin (or superadmin) signing in at one of their child-school slugs.
   *  They authenticate against public.platform_users and receive a session scoped to
   *  that school — the token carries the school's tenant context + their platform role,
   *  so tenant-scoped routes resolve the school schema while RBAC sees network_admin. */
  private async loginNetworkAdminIntoSchool(
    dto: LoginDto & { tenantSlug: string },
    tenant: { id: string; slug: string; name: string; parentId: string | null },
  ) {
    const pu = await this.prisma.platformUser.findFirst({
      where: { OR: [{ email: dto.identifier }, { username: dto.identifier }], status: 'active', deletedAt: null },
    });
    if (!pu) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(dto.password, pu.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const networkId = (pu as typeof pu & { networkId?: string | null }).networkId ?? null;
    const isSuperAdmin = pu.role === 'superadmin';
    const ownsSchool = pu.role === 'network_admin' && !!networkId && networkId === tenant.parentId;
    if (!isSuperAdmin && !ownsSchool) {
      throw new UnauthorizedException('You do not have access to this school');
    }

    await this.prisma.platformUser.update({ where: { id: pu.id }, data: { lastLoginAt: new Date() } });

    const payload: JwtPayload = {
      sub: pu.id,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      role: pu.role,
      isPlatformUser: true,
      ...(isSuperAdmin ? { isSuperAdmin: true } : {}),
      ...(networkId ? { networkId } : {}),
    };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = await this.generateRefreshToken(pu.id, tenant.id, tenant.slug, isSuperAdmin, true, pu.role, networkId);

    return {
      accessToken,
      refreshToken,
      user: { id: pu.id, email: pu.email, username: pu.username, fullName: pu.fullName, role: pu.role, networkId },
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
    };
  }

  async refresh(refreshToken: string) {
    const payload = await this.redis.getRefreshToken(refreshToken);
    if (!payload) throw new UnauthorizedException('Invalid or expired refresh token');

    await this.redis.deleteRefreshToken(refreshToken);

    // Rebuild the access token preserving whatever scope the session had — tenant
    // context (school users + a network admin inside a school) and/or platform flags.
    const newAccessToken = this.jwt.sign({
      sub: payload.userId,
      role: payload.role,
      ...(payload.tenantId ? { tenantId: payload.tenantId } : {}),
      ...(payload.tenantSlug ? { tenantSlug: payload.tenantSlug } : {}),
      ...(payload.isPlatformUser ? { isPlatformUser: true } : {}),
      ...(payload.isSuperAdmin ? { isSuperAdmin: true } : {}),
      ...(payload.networkId ? { networkId: payload.networkId } : {}),
      ...(payload.impersonatorId ? { impersonatorId: payload.impersonatorId } : {}),
      ...(payload.impersonatorRole ? { impersonatorRole: payload.impersonatorRole } : {}),
    } as JwtPayload);

    const newRefreshToken = await this.generateRefreshToken(
      payload.userId,
      payload.tenantId,
      payload.tenantSlug,
      payload.isSuperAdmin,
      payload.isPlatformUser,
      payload.role,
      payload.networkId,
      payload.impersonatorId,
      payload.impersonatorRole,
    );

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string) {
    await this.redis.deleteRefreshToken(refreshToken);
    return { message: 'Logged out successfully.' };
  }

  // ── Impersonation ("act as" a school user) ──────────────────────────────────
  private static readonly IMPERSONATABLE_ROLES = ['school_admin', 'principal', 'finance', 'teacher', 'admission'];

  /** A foundation/network admin (or superadmin) acts as a specific user inside one
   *  of their child schools. The minted token's `sub` is the target user (so writes
   *  attribute to a real in-schema user), with the platform admin recorded as the
   *  impersonator for audit + exit. */
  async impersonate(
    actor: { userId: string; role?: string; isPlatformUser?: boolean; isSuperAdmin?: boolean; networkId?: string | null },
    dto: { tenantSlug: string; userId: string },
  ) {
    const isSuper = !!actor.isSuperAdmin || actor.role === 'superadmin';
    const isNetworkAdmin = !!actor.isPlatformUser && actor.role === 'network_admin';
    if (!isSuper && !isNetworkAdmin) {
      throw new ForbiddenException('Only foundation/network admins can act as another user');
    }

    const tenant = await this.prisma.tenant.findFirst({ where: { slug: dto.tenantSlug, deletedAt: null } });
    if (!tenant) throw new NotFoundException(`School '${dto.tenantSlug}' not found`);
    if ((tenant as typeof tenant & { type?: string }).type !== 'school') {
      throw new BadRequestException('You can only act as a user inside a school');
    }
    if (!isSuper && tenant.parentId !== actor.networkId) {
      throw new ForbiddenException('This school is not in your network');
    }

    const db = this.tenantPrisma.forSchema(toSchemaName(tenant.slug));
    const target = await db.user.findFirst({ where: { id: dto.userId, deletedAt: null, status: 'active' } });
    if (!target) throw new NotFoundException('Target user not found in this school');
    if (!AuthService.IMPERSONATABLE_ROLES.includes(target.role as string)) {
      throw new BadRequestException(`You cannot act as a ${target.role}`);
    }

    const payload: JwtPayload = {
      sub: target.id,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      role: target.role as string,
      impersonatorId: actor.userId,
      impersonatorRole: actor.role,
      ...(actor.networkId ? { networkId: actor.networkId } : {}),
    };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = await this.generateRefreshToken(
      target.id, tenant.id, tenant.slug, false, false, target.role as string,
      actor.networkId ?? null, actor.userId, actor.role,
    );

    const networkId = actor.networkId ?? tenant.parentId;
    if (networkId) {
      await this.prisma.foundationAuditLog.create({
        data: {
          networkId, actorId: actor.userId, action: 'impersonate_start',
          resource: 'user', resourceId: target.id,
          metadata: { schoolSlug: tenant.slug, role: target.role },
        },
      }).catch(() => undefined);
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: target.id, email: target.email, username: target.username,
        fullName: target.fullName, avatarUrl: target.avatarUrl, role: target.role,
      },
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      impersonator: { id: actor.userId, role: actor.role },
    };
  }

  /** End an impersonation session: re-mint a foundation session for the original
   *  platform admin (identified by the token's impersonatorId). */
  async stopImpersonation(actor: { impersonatorId?: string }) {
    if (!actor.impersonatorId) throw new BadRequestException('Not in an impersonation session');
    const pu = await this.prisma.platformUser.findFirst({ where: { id: actor.impersonatorId, deletedAt: null } });
    if (!pu) throw new UnauthorizedException('Original account not found');

    const isSuperAdmin = pu.role === 'superadmin';
    const networkId = (pu as typeof pu & { networkId?: string | null }).networkId ?? null;
    const accessToken = this.signPlatformToken(pu.id, pu.role, networkId, isSuperAdmin);
    const refreshToken = await this.generateRefreshToken(pu.id, undefined, undefined, isSuperAdmin, true, pu.role, networkId);

    if (networkId) {
      await this.prisma.foundationAuditLog.create({
        data: { networkId, actorId: pu.id, action: 'impersonate_stop', resource: 'user', metadata: {} },
      }).catch(() => undefined);
    }

    return {
      accessToken,
      refreshToken,
      user: { id: pu.id, email: pu.email, username: pu.username, fullName: pu.fullName, role: pu.role, networkId },
    };
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
      accessToken: this.signToken(user.id, tenant.id, tenant.slug, user.role),
      user,
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
      },
    };
  }

  async me(userId: string, tenantSlug: string | undefined, isPlatformUser: boolean) {
    if (isPlatformUser) {
      const user = await (this.prisma.platformUser as any).findFirst({
        where: { id: userId, status: 'active', deletedAt: null },
        select: {
          id: true,
          email: true,
          username: true,
          fullName: true,
          role: true,
          networkId: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
      });
      if (!user) throw new NotFoundException('User not found');
      return user;
    }
    const [school, user] = await Promise.all([
      this.prisma.tenant.findFirst({
        where: { slug: tenantSlug, deletedAt: null },
        select: SCHOOL_SELECT,
      }),
      this.tenantPrisma.forSchema(toSchemaName(tenantSlug!)).user.findFirst({
        where: { id: userId, deletedAt: null, status: 'active' },
        select: SAFE_USER_SELECT,
      }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    if (!school) throw new NotFoundException('School not found');
    return { ...user, school };
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

  private signToken(userId: string, tenantId: string, tenantSlug: string, role?: string): string {
    const payload: JwtPayload = { sub: userId, tenantId, tenantSlug, role };
    return this.jwt.sign(payload);
  }

  private signPlatformToken(userId: string, role?: string, networkId?: string | null, isSuperAdmin = false): string {
    const payload: JwtPayload = { sub: userId, isSuperAdmin, isPlatformUser: true, role };
    if (networkId) payload.networkId = networkId;
    return this.jwt.sign(payload);
  }

  private async generateRefreshToken(
    userId: string,
    tenantId?: string,
    tenantSlug?: string,
    isSuperAdmin?: boolean,
    isPlatformUser?: boolean,
    role?: string,
    networkId?: string | null,
    impersonatorId?: string,
    impersonatorRole?: string,
  ): Promise<string> {
    const token = randomBytes(40).toString('hex');
    await this.redis.saveRefreshToken(token, {
      userId, tenantId, tenantSlug, isSuperAdmin, isPlatformUser, role,
      networkId: networkId ?? undefined, impersonatorId, impersonatorRole,
    });
    return token;
  }
}

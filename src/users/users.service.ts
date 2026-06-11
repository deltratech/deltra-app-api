import {
  BadRequestException,
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PlatformUserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { StorageService } from '../storage/storage.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateNetworkAdminDto } from './dto/create-network-admin.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateRolesDto } from './dto/update-roles.dto';
import { paginatedResult } from '../common/utils/paginate';

const SAFE_SELECT = {
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
  updatedAt: true,
};

const SAFE_PLATFORM_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  role: true,
  networkId: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: PrismaTenantService,
    private readonly storage: StorageService,
  ) {}

  async findAll(filters: { page?: number; limit?: number; search?: string; role?: string } = {}) {
    const { page = 1, limit = 20, search, role } = filters;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(role ? { role: role as any } : {}),
      ...(search ? {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' as const } },
          { email:    { contains: search, mode: 'insensitive' as const } },
          { username: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.tenantPrisma.client.user.findMany({ where, select: SAFE_SELECT, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.tenantPrisma.client.user.count({ where }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findPlatformUsers(
    filters: { page?: number; limit?: number; search?: string; role?: string } = {},
    actor?: { isPlatformUser?: boolean; isSuperAdmin?: boolean },
  ) {
    if (!actor?.isPlatformUser || !actor.isSuperAdmin) {
      throw new ForbiddenException('Superadmin access required');
    }

    const { page = 1, limit = 20, search, role } = filters;
    const skip = (page - 1) * limit;
    const where = {
      deletedAt: null,
      ...(role ? { role: role as PlatformUserRole } : {}),
      ...(search ? {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { username: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.platformUser.findMany({
        where,
        select: {
          ...SAFE_PLATFORM_USER_SELECT,
          network: { select: { id: true, name: true, slug: true, type: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.platformUser.count({ where }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const user = await this.tenantPrisma.client.user.findFirst({
      where: { id, deletedAt: null },
      select: SAFE_SELECT,
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  /** Current user's reusable signature (base64 PNG data URL). */
  async getMySignature(userId: string) {
    const user = await this.tenantPrisma.client.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, signatureData: true },
    });
    if (!user) throw new NotFoundException('Current user not found');
    return user;
  }

  /** Save or clear the current user's reusable signature. */
  async updateMySignature(userId: string, signatureData: string | null) {
    if (signatureData !== null && !/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(signatureData)) {
      throw new BadRequestException('signatureData must be a base64 image data URL (data:image/png;base64,…)');
    }
    const user = await this.tenantPrisma.client.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Current user not found');
    return this.tenantPrisma.client.user.update({
      where: { id: userId },
      data: { signatureData },
      select: { id: true, signatureData: true },
    });
  }

  /** Grant/revoke a user's contract-approval delegation. Principal-only (or superadmin). */
  async updateContractApprover(
    targetUserId: string,
    enabled: boolean,
    actor: { userId: string; isSuperAdmin?: boolean; role?: string },
  ) {
    if (!actor.isSuperAdmin && actor.role !== 'principal') {
      throw new ForbiddenException('Only the principal may manage approval delegates');
    }
    const user = await this.tenantPrisma.client.user.findFirst({
      where: { id: targetUserId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new NotFoundException(`User ${targetUserId} not found`);
    return this.tenantPrisma.client.user.update({
      where: { id: targetUserId },
      data: { contractApprover: enabled },
      select: { id: true, contractApprover: true },
    });
  }

  async create(dto: CreateUserDto) {
    if (!dto.email) {
      throw new BadRequestException('Email is required');
    }

    if (dto.email) {
      const exists = await this.tenantPrisma.client.user.findUnique({
        where: { email: dto.email },
      });
      if (exists) throw new ConflictException(`Email '${dto.email}' is already registered`);
    }

    if (dto.username) {
      const exists = await this.tenantPrisma.client.user.findUnique({
        where: { username: dto.username },
      });
      if (exists) throw new ConflictException(`Username '${dto.username}' is already taken`);
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : null;

    return this.tenantPrisma.client.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        fullName: dto.fullName,
        phone: dto.phone,
        avatarUrl: dto.avatarUrl,
        role: dto.role,
        passwordHash,
      },
      select: SAFE_SELECT,
    });
  }

  async createNetworkAdmin(dto: CreateNetworkAdminDto, actor?: { isPlatformUser?: boolean; isSuperAdmin?: boolean }) {
    if (!actor?.isPlatformUser || !actor.isSuperAdmin) {
      throw new ForbiddenException('Superadmin access required');
    }

    if (!dto.email && !dto.username) {
      throw new BadRequestException('Email or username is required');
    }

    const network = await this.prisma.tenant.findFirst({
      where: { id: dto.networkId, type: 'network', deletedAt: null },
      select: { id: true, name: true, slug: true },
    });
    if (!network) {
      throw new NotFoundException(`Network ${dto.networkId} not found`);
    }

    if (dto.email) {
      const exists = await this.prisma.platformUser.findUnique({ where: { email: dto.email } });
      if (exists) throw new ConflictException(`Email '${dto.email}' is already registered`);
    }

    if (dto.username) {
      const exists = await this.prisma.platformUser.findUnique({ where: { username: dto.username } });
      if (exists) throw new ConflictException(`Username '${dto.username}' is already taken`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.platformUser.create({
      data: {
        email: dto.email,
        username: dto.username,
        fullName: dto.fullName,
        passwordHash,
        role: PlatformUserRole.network_admin,
        networkId: network.id,
      },
      select: SAFE_PLATFORM_USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);

    if (dto.username) {
      const conflict = await this.tenantPrisma.client.user.findFirst({
        where: { username: dto.username, deletedAt: null, NOT: { id } },
      });
      if (conflict) throw new ConflictException(`Username '${dto.username}' is already taken`);
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : undefined;

    return this.tenantPrisma.client.user.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        username: dto.username,
        phone: dto.phone,
        avatarUrl: dto.avatarUrl,
        ...(passwordHash && { passwordHash }),
      },
      select: SAFE_SELECT,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.tenantPrisma.client.user.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: SAFE_SELECT,
    });
  }

  async updateAvatar(
    userId: string,
    file: Express.Multer.File,
    tenantSlug: string,
  ) {
    const user = await this.tenantPrisma.client.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, avatarUrl: true },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    // Delete old avatar from storage if it exists
    if (user.avatarUrl) await this.storage.delete(user.avatarUrl);

    const avatarUrl = await this.storage.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      'avatars',
      tenantSlug,
    );

    return this.tenantPrisma.client.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: SAFE_SELECT,
    });
  }

  async bulkUpdateRoles(dto: UpdateRolesDto) {
    const results = await Promise.allSettled(
      dto.users.map(({ id, role }) =>
        this.tenantPrisma.client.user.update({
          where: { id },
          data: { role },
          select: { id: true, email: true, role: true },
        }),
      ),
    );

    return results.map((r, i) =>
      r.status === 'fulfilled'
        ? { id: dto.users[i].id, success: true, data: r.value }
        : { id: dto.users[i].id, success: false, error: (r.reason as Error).message },
    );
  }
}

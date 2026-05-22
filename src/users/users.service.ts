import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { StorageService } from '../storage/storage.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateRolesDto } from './dto/update-roles.dto';
import { paginatedResult } from '../common/utils/paginate';

const SAFE_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  avatarUrl: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(
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

  async findOne(id: string) {
    const user = await this.tenantPrisma.client.user.findFirst({
      where: { id, deletedAt: null },
      select: SAFE_SELECT,
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(dto: CreateUserDto) {
    const exists = await this.tenantPrisma.client.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException(`Email '${dto.email}' is already registered`);

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : null;

    return this.tenantPrisma.client.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        phone: dto.phone,
        avatarUrl: dto.avatarUrl,
        role: dto.role,
        passwordHash,
      },
      select: SAFE_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : undefined;

    return this.tenantPrisma.client.user.update({
      where: { id },
      data: {
        fullName: dto.fullName,
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

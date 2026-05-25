import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { MigrationResult, TenantProvisionService } from '../tenant/tenant-provision.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { toSchemaName } from '../tenant/tenant.utils';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { UpsertTenantSettingsDto } from './dto/upsert-tenant-settings.dto';
import { paginatedResult } from '../common/utils/paginate';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: PrismaTenantService,
    private readonly provision: TenantProvisionService,
  ) {}

  async findAll(filters: { page?: number; limit?: number; search?: string } = {}) {
    const { page = 1, limit = 20, search } = filters;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { slug: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.tenant.count({ where }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
    });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant;
  }

  async create(dto: CreateTenantDto) {
    const exists = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (exists) throw new ConflictException(`Slug '${dto.slug}' is already taken`);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        type: dto.type,
        plan: dto.plan,
        parentId: dto.parentId,
      },
    });

    try {
      await this.provision.provision(tenant.slug);
    } catch (err) {
      this.logger.error(`create() provision failed for "${tenant.slug}", rolling back`, err);
      await this.prisma.tenant.delete({ where: { id: tenant.id } }).catch((e) =>
        this.logger.error(`Rollback: tenant delete failed "${tenant.id}"`, e),
      );
      throw err;
    }

    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id);
    return this.prisma.tenant.update({
      where: { id },
      data: dto,
    });
  }

  async register(dto: RegisterTenantDto) {
    const slugExists = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (slugExists) throw new ConflictException(`Slug '${dto.slug}' is already taken`);

    // 1. Create tenant record in public schema
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.tenantName,
        slug: dto.slug,
        type: dto.type,
      },
    });

    try {
      // 2. Provision tenant schema + run migrations
      await this.provision.provision(tenant.slug);

      // 3. Create the school admin user inside the newly provisioned tenant schema
      const passwordHash = await bcrypt.hash(dto.adminPassword, 12);
      const db = this.tenantPrisma.forSchema(toSchemaName(tenant.slug));

      const adminUser = await db.user.create({
        data: {
          email: dto.adminEmail,
          fullName: dto.adminName,
          phone: dto.adminPhone,
          passwordHash,
          role: 'school_admin',
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          createdAt: true,
        },
      });

      return { tenant, adminUser };
    } catch (err) {
      this.logger.error(`register() failed for "${tenant.slug}", rolling back`, err);
      await this.provision.deprovision(tenant.slug).catch((e) =>
        this.logger.error(`Rollback: deprovision failed for "${tenant.slug}"`, e),
      );
      await this.prisma.tenant.delete({ where: { id: tenant.id } }).catch((e) =>
        this.logger.error(`Rollback: tenant delete failed "${tenant.id}"`, e),
      );
      throw err;
    }
  }

  async validateSlug(rawSlug: string) {
    const slug = rawSlug.trim().toLowerCase();
    const existing = await this.prisma.tenant.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true, slug: true },
    });

    return {
      slug,
      available: !existing,
      message: existing ? `Slug '${slug}' is already taken` : `Slug '${slug}' is available`,
    };
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getSettings(tenantId: string) {
    await this.findOne(tenantId);
    const settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId },
    });
    if (!settings) throw new NotFoundException(`Settings for tenant ${tenantId} not found`);
    return settings;
  }

  async upsertSettings(tenantId: string, dto: UpsertTenantSettingsDto) {
    await this.findOne(tenantId);
    return this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...dto },
      update: dto,
    });
  }

  async deleteSettings(tenantId: string) {
    await this.getSettings(tenantId);
    return this.prisma.tenantSettings.delete({ where: { tenantId } });
  }

  // ── Migration management ─────────────────────────────────────────────────────

  async migrateAll(): Promise<MigrationResult[]> {
    return this.provision.migrateAll();
  }

  async migrateTenant(id: string): Promise<{ slug: string; schema: string; status: string }> {
    const tenant = await this.findOne(id);
    await this.provision.migrateOne(tenant.slug);
    return { slug: tenant.slug, schema: toSchemaName(tenant.slug), status: 'ok' };
  }
}

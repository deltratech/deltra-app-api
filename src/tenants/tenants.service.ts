import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { MigrationResult, TenantProvisionService } from '../tenant/tenant-provision.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { toSchemaName } from '../tenant/tenant.utils';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { UpsertTenantSettingsDto } from './dto/upsert-tenant-settings.dto';
import { paginatedResult } from '../common/utils/paginate';

type TenantSummary = {
  id: string;
  name: string;
  slug: string;
  type: 'school' | 'network';
  parentId: string | null;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
};

type TenantRelationSummary = Pick<TenantSummary, 'id' | 'name' | 'slug' | 'type' | 'status'>;

type TenantDetail = TenantSummary & {
  deletedAt: Date | null;
};

type TenantTree = TenantSummary & {
  children: TenantSummary[] | null;
};

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

    const searchTerm = search?.trim();
    const searchWhere = searchTerm
      ? Prisma.sql`
          AND (
            t.name ILIKE ${`%${searchTerm}%`}
            OR t.slug ILIKE ${`%${searchTerm}%`}
            OR EXISTS (
              SELECT 1
              FROM public.tenants c
              WHERE c.parent_id = t.id
                AND c.deleted_at IS NULL
                AND (c.name ILIKE ${`%${searchTerm}%`} OR c.slug ILIKE ${`%${searchTerm}%`})
            )
          )
        `
      : Prisma.empty;

    const [parents, total] = await Promise.all([
      this.prisma.$queryRaw<TenantSummary[]>`
        SELECT
          t.id,
          t.name,
          t.slug,
          t.type::text AS type,
          t.parent_id AS "parentId",
          t.status::text AS status,
          t.created_at AS "createdAt",
          t.updated_at AS "updatedAt"
        FROM public.tenants t
        WHERE t.deleted_at IS NULL
          AND t.parent_id IS NULL
        ${searchWhere}
        ORDER BY t.created_at DESC
        LIMIT ${limit}
        OFFSET ${skip}
      `,
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM public.tenants t
        WHERE t.deleted_at IS NULL
          AND t.parent_id IS NULL
        ${searchWhere}
      `,
    ]);

    const children = parents.length
      ? await this.prisma.$queryRaw<TenantSummary[]>`
          SELECT
            id,
            name,
            slug,
            type::text AS type,
            parent_id AS "parentId",
            status::text AS status,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM public.tenants
          WHERE deleted_at IS NULL
            AND parent_id = ANY(ARRAY[${Prisma.join(parents.map((tenant) => tenant.id))}]::uuid[])
          ORDER BY created_at ASC
        `
      : [];

    const childrenByParentId = children.reduce<Record<string, TenantSummary[]>>((acc, child) => {
      if (!child.parentId) return acc;
      acc[child.parentId] = acc[child.parentId] ?? [];
      acc[child.parentId].push(child);
      return acc;
    }, {});

    const data: TenantTree[] = parents.map((tenant) => {
      const tenantChildren = childrenByParentId[tenant.id] ?? [];
      return {
        ...tenant,
        children: tenantChildren.length ? tenantChildren : null,
      };
    });

    return paginatedResult(data, Number(total[0]?.count ?? 0), page, limit);
  }

  async findOne(id: string) {
    const [tenant] = await this.prisma.$queryRaw<TenantDetail[]>`
      SELECT
        id,
        name,
        slug,
        type::text AS type,
        parent_id AS "parentId",
        status::text AS status,
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        deleted_at AS "deletedAt"
      FROM public.tenants
      WHERE id = ${id}::uuid
        AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);

    const [parent, children] = await Promise.all([
      tenant.parentId
        ? this.prisma.$queryRaw<TenantRelationSummary[]>`
            SELECT
              id,
              name,
              slug,
              type::text AS type,
              status::text AS status
            FROM public.tenants
            WHERE id = ${tenant.parentId}::uuid
              AND deleted_at IS NULL
            LIMIT 1
          `
        : Promise.resolve([]),
      this.prisma.$queryRaw<TenantRelationSummary[]>`
        SELECT
          id,
          name,
          slug,
          type::text AS type,
          status::text AS status
        FROM public.tenants
        WHERE parent_id = ${id}::uuid
          AND deleted_at IS NULL
        ORDER BY name ASC
      `,
    ]);

    return { ...tenant, parent: parent[0] ?? null, children };
  }

  async create(dto: CreateTenantDto) {
    const exists = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (exists) throw new ConflictException(`Slug '${dto.slug}' is already taken`);

    await this.validateTenantHierarchy(dto.type, dto.parentId);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        type: dto.type,
        parentId: dto.parentId,
      },
    });

    if (tenant.type === 'network') return tenant;

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
    const tenant = await this.findOne(id);
    const nextType = dto.type ?? tenant.type;
    const nextParentId = dto.parentId === undefined ? tenant.parentId : dto.parentId;
    await this.validateTenantHierarchy(nextType, nextParentId);

    const updates: Prisma.Sql[] = [Prisma.sql`updated_at = NOW()`];
    if (dto.name !== undefined) updates.push(Prisma.sql`name = ${dto.name}`);
    if (dto.type !== undefined) updates.push(Prisma.sql`type = ${dto.type}::tenant_type`);
    if (dto.parentId !== undefined) {
      updates.push(
        dto.parentId === null
          ? Prisma.sql`parent_id = NULL`
          : Prisma.sql`parent_id = ${dto.parentId}::uuid`,
      );
    }
    if (dto.status !== undefined) updates.push(Prisma.sql`status = ${dto.status}::tenant_status`);

    const [updated] = await this.prisma.$queryRaw<TenantDetail[]>`
      UPDATE public.tenants
      SET ${Prisma.join(updates, ', ')}
      WHERE id = ${id}::uuid
        AND deleted_at IS NULL
      RETURNING
        id,
        name,
        slug,
        type::text AS type,
        parent_id AS "parentId",
        status::text AS status,
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        deleted_at AS "deletedAt"
    `;

    if (!updated) throw new NotFoundException(`Tenant ${id} not found`);
    return updated;
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
      if (tenant.type === 'network') {
        const passwordHash = await bcrypt.hash(dto.adminPassword, 12);
        const adminUser = await this.prisma.platformUser.create({
          data: {
            email: dto.adminEmail,
            fullName: dto.adminName,
            passwordHash,
            role: 'network_admin',
            networkId: tenant.id,
          },
          select: {
            id: true,
            email: true,
            username: true,
            fullName: true,
            role: true,
            networkId: true,
            status: true,
            createdAt: true,
          },
        });

        return { tenant, adminUser };
      }

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

  async resolveBySlug(rawSlug: string) {
    const slug = rawSlug.trim().toLowerCase();
    const [tenant] = await this.prisma.$queryRaw<
      Array<{
        id: string;
        slug: string;
        name: string;
        type: 'school' | 'network';
        status: 'active' | 'inactive' | 'suspended';
        deletedAt: Date | null;
        logoUrl: string | null;
        primaryColor: string | null;
        secondaryColor: string | null;
        locale: string | null;
        timezone: string | null;
      }>
    >`
      SELECT
        t.id,
        t.slug,
        t.name,
        t.type::text AS type,
        t.status::text AS status,
        t.deleted_at AS "deletedAt"     
      FROM public.tenants t      
      WHERE t.slug = ${slug}
      LIMIT 1
    `;

    if (!tenant || tenant.deletedAt) throw new NotFoundException(`Tenant '${slug}' not found`);
    if (tenant.status !== 'active') {
      throw new ForbiddenException({
        message: `School '${slug}' is ${tenant.status}`,
        status: tenant.status,
      });
    }

    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      type: tenant.type,
      status: tenant.status,
      settings: {
        logoUrl: tenant.logoUrl,
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor,
        locale: tenant.locale,
        timezone: tenant.timezone,
      },
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

  private async validateTenantHierarchy(type: 'school' | 'network', parentId?: string | null) {
    if (type === 'network' && parentId) {
      throw new BadRequestException('Foundation/network tenants cannot have a parent foundation');
    }

    if (type === 'school' && parentId) {
      const parent = await this.prisma.tenant.findFirst({
        where: { id: parentId, type: 'network', deletedAt: null },
        select: { id: true },
      });
      if (!parent) {
        throw new BadRequestException('parentId must reference an existing foundation/network tenant');
      }
    }
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

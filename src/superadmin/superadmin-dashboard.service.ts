import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type SuperadminActor = {
  userId: string;
  isPlatformUser?: boolean;
  isSuperAdmin?: boolean;
};

type TenantStatusCount = {
  status: 'active' | 'inactive' | 'suspended';
  count: bigint;
};

type TenantTypeCount = {
  type: 'school' | 'network';
  count: bigint;
};

type RecentOrganization = {
  id: string;
  name: string;
  slug: string;
  type: 'school' | 'network';
  status: 'active' | 'inactive' | 'suspended';
  childSchoolCount: number;
  createdAt: Date;
};

type FoundationOverview = {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive' | 'suspended';
  childSchoolCount: number;
  createdAt: Date;
};

type PlatformAdminRoleCount = {
  role: 'superadmin' | 'staff' | 'network_admin';
  count: bigint;
};

@Injectable()
export class SuperadminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(actor?: SuperadminActor) {
    if (!actor?.isPlatformUser || !actor.isSuperAdmin) {
      throw new ForbiddenException('Superadmin access required');
    }

    const [totalOrganizations, tenantTypeCounts, tenantStatusCounts, recentOrganizations, foundations, platformAdminCounts] =
      await Promise.all([
        this.prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM public.tenants
          WHERE deleted_at IS NULL
        `,
        this.prisma.$queryRaw<TenantTypeCount[]>`
          SELECT type::text AS type, COUNT(*)::bigint AS count
          FROM public.tenants
          WHERE deleted_at IS NULL
          GROUP BY type
        `,
        this.prisma.$queryRaw<TenantStatusCount[]>`
          SELECT status::text AS status, COUNT(*)::bigint AS count
          FROM public.tenants
          WHERE deleted_at IS NULL
          GROUP BY status
        `,
        this.prisma.$queryRaw<RecentOrganization[]>`
          SELECT
            t.id,
            t.name,
            t.slug,
            t.type::text AS type,
            t.status::text AS status,
            COUNT(c.id)::int AS "childSchoolCount",
            t.created_at AS "createdAt"
          FROM public.tenants t
          LEFT JOIN public.tenants c
            ON c.parent_id = t.id
           AND c.type = 'school'::tenant_type
           AND c.deleted_at IS NULL
          WHERE t.deleted_at IS NULL
          GROUP BY t.id, t.name, t.slug, t.type, t.status, t.created_at
          ORDER BY t.created_at DESC
          LIMIT 10
        `,
        this.prisma.$queryRaw<FoundationOverview[]>`
          SELECT
            t.id,
            t.name,
            t.slug,
            t.status::text AS status,
            COUNT(c.id)::int AS "childSchoolCount",
            t.created_at AS "createdAt"
          FROM public.tenants t
          LEFT JOIN public.tenants c
            ON c.parent_id = t.id
           AND c.type = 'school'::tenant_type
           AND c.deleted_at IS NULL
          WHERE t.deleted_at IS NULL
            AND t.type = 'network'::tenant_type
          GROUP BY t.id, t.name, t.slug, t.status, t.created_at
          ORDER BY COUNT(c.id) DESC, t.created_at DESC
          LIMIT 10
        `,
        this.prisma.$queryRaw<PlatformAdminRoleCount[]>`
          SELECT role::text AS role, COUNT(*)::bigint AS count
          FROM public.platform_users
          WHERE deleted_at IS NULL
          GROUP BY role
        `,
      ]);

    const schools = this.countBy(tenantTypeCounts, 'type', 'school');
    const foundationsCount = this.countBy(tenantTypeCounts, 'type', 'network');
    const active = this.countBy(tenantStatusCounts, 'status', 'active');
    const inactive = this.countBy(tenantStatusCounts, 'status', 'inactive');
    const suspended = this.countBy(tenantStatusCounts, 'status', 'suspended');
    const superadmins = this.countBy(platformAdminCounts, 'role', 'superadmin');
    const staff = this.countBy(platformAdminCounts, 'role', 'staff');
    const foundationAdmins = this.countBy(platformAdminCounts, 'role', 'network_admin');

    return {
      kpis: {
        totalOrganizations: Number(totalOrganizations[0]?.count ?? 0),
        totalSchools: schools,
        foundations: foundationsCount,
        activeOrganizations: active,
        platformAdmins: superadmins + staff + foundationAdmins,
      },
      statusCounts: {
        active,
        inactive,
        suspended,
      },
      platformAdmins: {
        superadmins,
        staff,
        foundationAdmins,
      },
      recentOrganizations,
      foundations,
    };
  }

  private countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T, value: string) {
    const row = rows.find((item) => item[key] === value) as (T & { count: bigint }) | undefined;
    return Number(row?.count ?? 0);
  }
}

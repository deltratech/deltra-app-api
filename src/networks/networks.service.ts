import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { toSchemaName } from '../tenant/tenant.utils';
import { CreateFoundationPolicyDto } from './dto/create-foundation-policy.dto';
import { UpdateFoundationPolicyDto } from './dto/update-foundation-policy.dto';

type NetworkUser = {
  userId: string;
  role?: string;
  networkId?: string;
  isSuperAdmin?: boolean;
};

type FoundationPolicyTemplateUpdateData = {
  name?: string;
  category?: string;
  description?: string;
  isActive?: boolean;
  content?: Prisma.InputJsonValue;
};

const SCHOOL_SELECT = {
  id: true,
  name: true,
  slug: true,
  type: true,
  parentId: true,
  createdAt: true,
  updatedAt: true,
  settings: true,
};

@Injectable()
export class NetworksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: PrismaTenantService,
  ) {}

  async listSchools(user: NetworkUser) {
    const networkId = this.requireNetworkAccess(user);
    const schools = await this.prisma.tenant.findMany({
      where: { parentId: networkId, type: 'school', deletedAt: null },
      select: SCHOOL_SELECT,
      orderBy: { name: 'asc' },
    });
    await this.audit(user, 'list_schools', 'tenant', networkId);
    return schools;
  }

  async getSchool(user: NetworkUser, schoolId: string) {
    const networkId = this.requireNetworkAccess(user);
    const school = await this.prisma.tenant.findFirst({
      where: { id: schoolId, parentId: networkId, type: 'school', deletedAt: null },
      select: SCHOOL_SELECT,
    });
    if (!school) throw new NotFoundException(`School ${schoolId} not found in this network`);

    const db = this.tenantPrisma.forSchema(toSchemaName(school.slug));
    const [users, students, teachers] = await Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.studentProfile.count(),
      db.teacherProfile.count({ where: { deletedAt: null } }),
    ]);

    await this.audit(user, 'view_school_detail', 'tenant', school.id);
    return { ...school, metrics: { users, students, teachers } };
  }

  async dashboard(user: NetworkUser) {
    const networkId = this.requireNetworkAccess(user);
    const schools = await (this.prisma.tenant as any).findMany({
      where: { parentId: networkId, type: 'school', deletedAt: null },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });

    const schoolMetrics = await Promise.all(
      schools.map(async (school) => {
        const db = this.tenantPrisma.forSchema(toSchemaName(school.slug));
        const [users, students, teachers, schedules] = await Promise.all([
          db.user.count({ where: { deletedAt: null } }),
          db.studentProfile.count(),
          db.teacherProfile.count({ where: { deletedAt: null } }),
          db.schedule.count(),
        ]);
        return { ...school, metrics: { users, students, teachers, schedules } };
      }),
    );

    const totals = schoolMetrics.reduce(
      (acc, school) => ({
        schools: acc.schools + 1,
        users: acc.users + school.metrics.users,
        students: acc.students + school.metrics.students,
        teachers: acc.teachers + school.metrics.teachers,
        schedules: acc.schedules + school.metrics.schedules,
      }),
      { schools: 0, users: 0, students: 0, teachers: 0, schedules: 0 },
    );

    await this.audit(user, 'view_dashboard', 'foundation_dashboard', networkId);
    return { totals, schools: schoolMetrics };
  }

  async listPolicies(user: NetworkUser, category?: string) {
    const networkId = this.requireNetworkAccess(user);
    return (this.prisma as any).foundationPolicyTemplate.findMany({
      where: { networkId, deletedAt: null, ...(category ? { category } : {}) },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async createPolicy(user: NetworkUser, dto: CreateFoundationPolicyDto) {
    const networkId = this.requireNetworkAccess(user);
    const policy = await (this.prisma as any).foundationPolicyTemplate.create({
      data: { networkId, ...dto, content: dto.content as Prisma.InputJsonValue },
    });
    await this.audit(user, 'create_policy_template', 'foundation_policy_template', policy.id, { category: policy.category });
    return policy;
  }

  async updatePolicy(user: NetworkUser, id: string, dto: UpdateFoundationPolicyDto) {
    const networkId = this.requireNetworkAccess(user);
    await this.findPolicy(networkId, id);
    const data: FoundationPolicyTemplateUpdateData = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.content !== undefined) data.content = dto.content as Prisma.InputJsonValue;
    const policy = await (this.prisma as any).foundationPolicyTemplate.update({
      where: { id },
      data,
    });
    await this.audit(user, 'update_policy_template', 'foundation_policy_template', id);
    return policy;
  }

  async deletePolicy(user: NetworkUser, id: string) {
    const networkId = this.requireNetworkAccess(user);
    await this.findPolicy(networkId, id);
    const policy = await (this.prisma as any).foundationPolicyTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit(user, 'delete_policy_template', 'foundation_policy_template', id);
    return policy;
  }

  async auditLogs(user: NetworkUser) {
    const networkId = this.requireNetworkAccess(user);
    return (this.prisma as any).foundationAuditLog.findMany({
      where: { networkId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private requireNetworkAccess(user: NetworkUser): string {
    if (user.isSuperAdmin && user.networkId) return user.networkId;
    if (user.role !== 'network_admin' || !user.networkId) {
      throw new ForbiddenException('Network admin access required');
    }
    return user.networkId;
  }

  private async findPolicy(networkId: string, id: string) {
    const policy = await (this.prisma as any).foundationPolicyTemplate.findFirst({
      where: { id, networkId, deletedAt: null },
    });
    if (!policy) throw new NotFoundException(`Policy template ${id} not found`);
    return policy;
  }

  private async audit(
    user: NetworkUser,
    action: string,
    resource: string,
    resourceId?: string,
    metadata?: Record<string, unknown>,
  ) {
    await (this.prisma as any).foundationAuditLog.create({
      data: {
        networkId: this.requireNetworkAccess(user),
        actorId: user.userId,
        action,
        resource,
        resourceId,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
}

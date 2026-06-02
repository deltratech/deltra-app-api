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

type DashboardWindow = 'daily' | 'weekly' | 'monthly';

type AttendanceWindowMetrics = {
  from: string;
  to: string;
  total: number;
  attended: number;
  present: number;
  late: number;
  excused: number;
  sick: number;
  absent: number;
  rate: number;
};

type SchoolHealthLevel = 'healthy' | 'attention' | 'risk';

type SchoolDashboardMetrics = {
  users: number;
  activeUsers30d: number;
  students: number;
  teachers: number;
  classrooms: number;
  schedules: number;
  publishedSchedules: number;
  homeroomAssignments: number;
  activeContracts: number;
  contractsExpiring30d: number;
  contractsExpiring90d: number;
  settingsConfigured: boolean;
  attendance: {
    daily: AttendanceWindowMetrics;
    weekly: AttendanceWindowMetrics;
    monthly: AttendanceWindowMetrics;
  };
};

type SchoolDashboardItem = {
  id: string;
  name: string;
  slug: string;
  type: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  settings: unknown;
  metrics: SchoolDashboardMetrics;
  healthScore: number;
  healthLevel: SchoolHealthLevel;
  flags: string[];
};

type DashboardSummary = {
  schools: number;
  users: number;
  activeUsers30d: number;
  students: number;
  teachers: number;
  classrooms: number;
  schedules: number;
  publishedSchedules: number;
  homeroomAssignments: number;
  activeContracts: number;
  contractsExpiring30d: number;
  contractsExpiring90d: number;
  healthySchools: number;
  attentionSchools: number;
  riskSchools: number;
  attendance: {
    daily: AttendanceWindowMetrics;
    weekly: AttendanceWindowMetrics;
    monthly: AttendanceWindowMetrics;
  };
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

const CONTRACT_SOON_WARNING_DAYS = 30;
const CONTRACT_EXTENDED_WARNING_DAYS = 90;
const ACTIVITY_RECENT_DAYS = 30;

@Injectable()
export class NetworksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: PrismaTenantService,
  ) {}

  async listSchools(user: NetworkUser) {
    const networkId = this.requireNetworkAccess(user);
    const network = await this.getNetwork(networkId);
    const schools = await this.prisma.tenant.findMany({
      where: { parentId: networkId, type: 'school', deletedAt: null },
      select: SCHOOL_SELECT,
      orderBy: { name: 'asc' },
    });
    await this.audit(user, 'list_schools', 'tenant', network.id);
    return { network, schools };
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
    const network = await this.getNetwork(networkId);
    const schools = await this.prisma.tenant.findMany({
      where: { parentId: networkId, type: 'school', deletedAt: null },
      select: SCHOOL_SELECT,
      orderBy: { name: 'asc' },
    });

    const schoolMetrics = await Promise.all(
      schools.map((school) => this.buildSchoolDashboardItem(school)),
    );

    const totals = schoolMetrics.reduce<DashboardSummary>(
      (acc, school) => {
        const metrics = school.metrics;
        return {
          ...acc,
          schools: acc.schools + 1,
          users: acc.users + metrics.users,
          activeUsers30d: acc.activeUsers30d + metrics.activeUsers30d,
          students: acc.students + metrics.students,
          teachers: acc.teachers + metrics.teachers,
          classrooms: acc.classrooms + metrics.classrooms,
          schedules: acc.schedules + metrics.schedules,
          publishedSchedules: acc.publishedSchedules + metrics.publishedSchedules,
          homeroomAssignments: acc.homeroomAssignments + metrics.homeroomAssignments,
          activeContracts: acc.activeContracts + metrics.activeContracts,
          contractsExpiring30d: acc.contractsExpiring30d + metrics.contractsExpiring30d,
          contractsExpiring90d: acc.contractsExpiring90d + metrics.contractsExpiring90d,
          healthySchools: acc.healthySchools + (school.healthLevel === 'healthy' ? 1 : 0),
          attentionSchools: acc.attentionSchools + (school.healthLevel === 'attention' ? 1 : 0),
          riskSchools: acc.riskSchools + (school.healthLevel === 'risk' ? 1 : 0),
          attendance: {
            daily: this.mergeAttendanceWindows(acc.attendance.daily, metrics.attendance.daily),
            weekly: this.mergeAttendanceWindows(acc.attendance.weekly, metrics.attendance.weekly),
            monthly: this.mergeAttendanceWindows(acc.attendance.monthly, metrics.attendance.monthly),
          },
        };
      },
      {
        schools: 0,
        users: 0,
        activeUsers30d: 0,
        students: 0,
        teachers: 0,
        classrooms: 0,
        schedules: 0,
        publishedSchedules: 0,
        homeroomAssignments: 0,
        activeContracts: 0,
        contractsExpiring30d: 0,
        contractsExpiring90d: 0,
        healthySchools: 0,
        attentionSchools: 0,
        riskSchools: 0,
        attendance: {
          daily: this.emptyAttendanceWindow(),
          weekly: this.emptyAttendanceWindow(),
          monthly: this.emptyAttendanceWindow(),
        },
      },
    );

    const recentActivity = await (this.prisma as any).foundationAuditLog.findMany({
      where: { networkId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    await this.audit(user, 'view_dashboard', 'foundation_dashboard', networkId);
    return {
      network,
      summary: totals,
      schools: schoolMetrics.sort((a, b) => a.healthScore - b.healthScore || a.name.localeCompare(b.name)),
      recentActivity,
    };
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

  private async getNetwork(networkId: string) {
    const network = await this.prisma.tenant.findFirst({
      where: { id: networkId, type: 'network', deletedAt: null },
      select: { id: true, name: true, slug: true, type: true, createdAt: true, updatedAt: true },
    });
    if (!network) throw new NotFoundException(`Network ${networkId} not found`);
    return network;
  }

  private async buildSchoolDashboardItem(
    school: {
      id: string;
      name: string;
      slug: string;
      type: string;
      parentId: string | null;
      createdAt: Date;
      updatedAt: Date;
      settings: unknown;
    },
  ): Promise<SchoolDashboardItem> {
    const db = this.tenantPrisma.forSchema(toSchemaName(school.slug));
    const now = new Date();
    const recentCutoff = this.startOfDay(this.addDays(now, -(ACTIVITY_RECENT_DAYS - 1)));
    const contract30Cutoff = this.startOfDay(now);
    const contract30Limit = this.endOfDay(this.addDays(now, CONTRACT_SOON_WARNING_DAYS));
    const contract90Limit = this.endOfDay(this.addDays(now, CONTRACT_EXTENDED_WARNING_DAYS));

    const [
      users,
      activeUsers30d,
      students,
      teachers,
      classrooms,
      schedules,
      publishedSchedules,
      homeroomAssignments,
      activeContracts,
      contractsExpiring30d,
      contractsExpiring90d,
      settings,
      attendanceDaily,
      attendanceWeekly,
      attendanceMonthly,
    ] = await Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.user.count({
        where: {
          deletedAt: null,
          status: 'active',
          lastLoginAt: { gte: recentCutoff },
        },
      }),
      db.studentProfile.count(),
      db.teacherProfile.count({ where: { deletedAt: null } }),
      db.classroom.count({ where: { deletedAt: null } }),
      db.schedule.count({ where: { deletedAt: null } }),
      db.schedule.count({ where: { deletedAt: null, status: 'published' } }),
      db.homeroomAssignment.count({ where: { deletedAt: null, isActive: true } }),
      db.teacherContract.count({ where: { deletedAt: null, status: { in: ['active', 'pending_signature', 'renewed'] } } }),
      this.countContractsWithin(db, contract30Cutoff, contract30Limit),
      this.countContractsWithin(db, contract30Cutoff, contract90Limit),
      this.prisma.tenantSettings.findUnique({ where: { tenantId: school.id }, select: { tenantId: true } }),
      this.getAttendanceWindow(db, 'daily', now),
      this.getAttendanceWindow(db, 'weekly', now),
      this.getAttendanceWindow(db, 'monthly', now),
    ]);

    const metrics: SchoolDashboardMetrics = {
      users,
      activeUsers30d,
      students,
      teachers,
      classrooms,
      schedules,
      publishedSchedules,
      homeroomAssignments,
      activeContracts,
      contractsExpiring30d,
      contractsExpiring90d,
      settingsConfigured: Boolean(settings),
      attendance: {
        daily: attendanceDaily,
        weekly: attendanceWeekly,
        monthly: attendanceMonthly,
      },
    };

    const { healthScore, healthLevel, flags } = this.calculateSchoolHealth(metrics);

    return {
      ...school,
      settings: school.settings ?? settings ?? null,
      metrics,
      healthScore,
      healthLevel,
      flags,
    };
  }

  private async getAttendanceWindow(db: any, window: DashboardWindow, now: Date): Promise<AttendanceWindowMetrics> {
    const range = this.getWindowRange(window, now);
    const rows = await db.attendanceRecord.groupBy({
      by: ['status'],
      where: {
        deletedAt: null,
        attendanceDate: {
          gte: range.from,
          lte: range.to,
        },
      },
      _count: { _all: true },
    });

    const counts = rows.reduce(
      (acc: AttendanceWindowMetrics, row: { status: string; _count: { _all: number } }) => {
        const value = row._count._all;
        switch (row.status) {
          case 'present':
            acc.present += value;
            acc.attended += value;
            break;
          case 'late':
            acc.late += value;
            acc.attended += value;
            break;
          case 'excused':
            acc.excused += value;
            break;
          case 'sick':
            acc.sick += value;
            break;
          case 'absent':
            acc.absent += value;
            break;
        }
        acc.total += value;
        return acc;
      },
      { ...this.emptyAttendanceWindow(), from: this.formatDate(range.from), to: this.formatDate(range.to) },
    );

    counts.rate = counts.total > 0 ? Math.round((counts.attended / counts.total) * 1000) / 10 : 0;
    return counts;
  }

  private countContractsWithin(db: any, from: Date, to: Date) {
    return db.teacherContract.count({
      where: {
        deletedAt: null,
        contractEndDate: {
          gte: this.formatDate(from),
          lte: this.formatDate(to),
        },
      },
    });
  }

  private calculateSchoolHealth(metrics: SchoolDashboardMetrics): {
    healthScore: number;
    healthLevel: SchoolHealthLevel;
    flags: string[];
  } {
    const attendanceScore = this.weightedAttendanceScore(metrics.attendance);
    const contractScore = this.contractScore(metrics);
    const activityScore = this.activityScore(metrics);
    const scheduleScore = this.scheduleScore(metrics);
    const setupScore = this.setupScore(metrics);

    const score = Math.round(
      attendanceScore * 0.35 +
      contractScore * 0.25 +
      activityScore * 0.15 +
      scheduleScore * 0.15 +
      setupScore * 0.10,
    );

    const flags = this.buildSchoolFlags(metrics);
    const healthLevel: SchoolHealthLevel = score >= 80 ? 'healthy' : score >= 60 ? 'attention' : 'risk';
    return { healthScore: score, healthLevel, flags };
  }

  private weightedAttendanceScore(attendance: SchoolDashboardMetrics['attendance']): number {
    const daily = attendance.daily.rate;
    const weekly = attendance.weekly.rate;
    const monthly = attendance.monthly.rate;
    return Math.round(daily * 0.25 + weekly * 0.35 + monthly * 0.4);
  }

  private contractScore(metrics: SchoolDashboardMetrics): number {
    if (metrics.activeContracts === 0) return metrics.teachers === 0 ? 100 : 40;
    const soonRatio = metrics.contractsExpiring30d / metrics.activeContracts;
    const extendedRatio = Math.max(0, metrics.contractsExpiring90d - metrics.contractsExpiring30d) / metrics.activeContracts;
    return Math.max(0, Math.round(100 - soonRatio * 70 - extendedRatio * 30));
  }

  private activityScore(metrics: SchoolDashboardMetrics): number {
    if (metrics.users === 0) return 0;
    return Math.round((metrics.activeUsers30d / metrics.users) * 100);
  }

  private scheduleScore(metrics: SchoolDashboardMetrics): number {
    if (metrics.classrooms === 0) return 0;
    const publishedRatio = metrics.schedules === 0 ? 0 : metrics.publishedSchedules / metrics.schedules;
    const homeroomRatio = metrics.classrooms === 0 ? 0 : Math.min(1, metrics.homeroomAssignments / metrics.classrooms);
    return Math.round(publishedRatio * 60 + homeroomRatio * 40);
  }

  private setupScore(metrics: SchoolDashboardMetrics): number {
    const settingsScore = metrics.settingsConfigured ? 50 : 0;
    const teacherScore = metrics.teachers > 0 ? 25 : 0;
    const classroomScore = metrics.classrooms > 0 ? 25 : 0;
    return settingsScore + teacherScore + classroomScore;
  }

  private buildSchoolFlags(metrics: SchoolDashboardMetrics): string[] {
    const flags: string[] = [];
    if (!metrics.settingsConfigured) flags.push('missing_settings');
    if (metrics.students === 0) flags.push('no_students');
    if (metrics.teachers === 0) flags.push('no_teachers');
    if (metrics.attendance.monthly.total === 0) flags.push('attendance_data_missing');
    if (metrics.attendance.monthly.rate < 90) flags.push('low_monthly_attendance');
    if (metrics.attendance.weekly.rate < 90) flags.push('low_weekly_attendance');
    if (metrics.attendance.daily.rate < 90) flags.push('low_daily_attendance');
    if (metrics.contractsExpiring30d > 0) flags.push('contracts_expiring_soon');
    if (metrics.publishedSchedules === 0 && metrics.schedules > 0) flags.push('no_published_schedules');
    if (metrics.schedules === 0) flags.push('no_schedules');
    if (metrics.homeroomAssignments === 0 && metrics.classrooms > 0) flags.push('no_homeroom_assignments');
    if (metrics.activeUsers30d === 0 && metrics.users > 0) flags.push('inactive_users');
    return flags;
  }

  private getWindowRange(window: DashboardWindow, now: Date): { from: Date; to: Date } {
    if (window === 'daily') {
      const from = this.startOfDay(now);
      return { from, to: this.endOfDay(now) };
    }

    if (window === 'weekly') {
      const from = this.startOfDay(this.addDays(now, -6));
      return { from, to: this.endOfDay(now) };
    }

    const from = this.startOfDay(this.addDays(now, -29));
    return { from, to: this.endOfDay(now) };
  }

  private mergeAttendanceWindows(left: AttendanceWindowMetrics, right: AttendanceWindowMetrics): AttendanceWindowMetrics {
    const total = left.total + right.total;
    const attended = left.attended + right.attended;
    const merged = {
      from: left.from || right.from,
      to: right.to || left.to,
      total,
      attended,
      present: left.present + right.present,
      late: left.late + right.late,
      excused: left.excused + right.excused,
      sick: left.sick + right.sick,
      absent: left.absent + right.absent,
      rate: 0,
    };
    merged.rate = total > 0 ? Math.round((attended / total) * 1000) / 10 : 0;
    return merged;
  }

  private emptyAttendanceWindow(): AttendanceWindowMetrics {
    return {
      from: '',
      to: '',
      total: 0,
      attended: 0,
      present: 0,
      late: 0,
      excused: 0,
      sick: 0,
      absent: 0,
      rate: 0,
    };
  }

  private addDays(date: Date, days: number): Date {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  private startOfDay(date: Date): Date {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  private endOfDay(date: Date): Date {
    const copy = new Date(date);
    copy.setHours(23, 59, 59, 999);
    return copy;
  }

  private formatDate(date: Date): Date {
    return new Date(date);
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

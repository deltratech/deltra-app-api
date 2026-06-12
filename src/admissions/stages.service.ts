import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';

export type StageRole = 'entry' | 'test' | 'offer' | 'accepted' | 'enrolled' | 'rejected' | 'generic';

/** Roles that may be assigned to at most one stage (they drive unique automation). */
const SINGLETON_ROLES: StageRole[] = ['entry', 'test', 'offer', 'accepted', 'enrolled'];

/** Default pipeline seeded for a fresh tenant (mirrors the migration seed). */
const DEFAULTS = [
  { key: 'applied',  label: 'Applied',  role: 'entry',    sortOrder: 10, color: 'bg-slate-400' },
  { key: 'test',     label: 'Test',     role: 'test',     sortOrder: 20, color: 'bg-violet-400' },
  { key: 'passed',   label: 'Passed',   role: 'generic',  sortOrder: 30, color: 'bg-emerald-400' },
  { key: 'payment',  label: 'Payment',  role: 'offer',    sortOrder: 40, color: 'bg-amber-400' },
  { key: 'enrolled', label: 'Enrolled', role: 'enrolled', sortOrder: 50, color: 'bg-sky-500' },
  { key: 'rejected', label: 'Rejected', role: 'rejected', sortOrder: 60, color: 'bg-red-400' },
];

@Injectable()
export class StagesService {
  constructor(private readonly tenantPrisma: PrismaTenantService) {}

  private get db() { return this.tenantPrisma.client.admissionStageDef; }
  private get apps() { return this.tenantPrisma.client.admissionApplication; }

  /** Seed the default pipeline for tenants that have none yet. */
  async ensureSeeded() {
    if ((await this.db.count()) === 0) {
      await this.db.createMany({ data: DEFAULTS as any });
    }
  }

  async list() {
    await this.ensureSeeded();
    return this.db.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async roleOf(key: string): Promise<StageRole> {
    const def = await this.db.findUnique({ where: { key } });
    if (!def) throw new BadRequestException(`Unknown stage "${key}"`);
    return def.role as StageRole;
  }

  async keyByRole(role: StageRole): Promise<string | null> {
    const def = await this.db.findFirst({ where: { role: role as any, isActive: true }, orderBy: { sortOrder: 'asc' } });
    return def?.key ?? null;
  }

  /** Where new applications land. Falls back to 'applied' if no entry stage is set. */
  async entryKey(): Promise<string> {
    return (await this.keyByRole('entry')) ?? (await this.list())[0]?.key ?? 'applied';
  }

  private slugify(label: string) {
    return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'stage';
  }

  async create(dto: { label: string; role?: StageRole; color?: string | null; publicLabel?: string | null }) {
    await this.ensureSeeded();
    const role = (dto.role ?? 'generic') as StageRole;
    await this.assertSingleton(role, null);
    let key = this.slugify(dto.label);
    if (await this.db.findUnique({ where: { key } })) key = `${key}-${Date.now().toString(36)}`;
    const max = await this.db.aggregate({ _max: { sortOrder: true } });
    return this.db.create({
      data: { key, label: dto.label, role: role as any, color: dto.color ?? null, publicLabel: dto.publicLabel ?? null, sortOrder: (max._max.sortOrder ?? 0) + 10 },
    });
  }

  async update(id: string, dto: { label?: string; role?: StageRole; color?: string | null; publicLabel?: string | null; isActive?: boolean }) {
    const def = await this.db.findUnique({ where: { id } });
    if (!def) throw new NotFoundException('Stage not found');
    if (dto.role && dto.role !== def.role) await this.assertSingleton(dto.role, id);
    return this.db.update({
      where: { id },
      data: {
        label: dto.label,
        role: dto.role as any,
        color: dto.color,
        publicLabel: dto.publicLabel,
        isActive: dto.isActive,
      },
    });
  }

  async reorder(ids: string[]) {
    if (!Array.isArray(ids) || !ids.length) throw new BadRequestException('ids are required');
    await Promise.all(ids.map((id, i) => this.db.update({ where: { id }, data: { sortOrder: (i + 1) * 10 } })));
    return this.list();
  }

  async remove(id: string) {
    const def = await this.db.findUnique({ where: { id } });
    if (!def) throw new NotFoundException('Stage not found');
    if (def.role === 'entry') throw new BadRequestException('Cannot delete the entry stage');
    const count = await this.apps.count({ where: { stageKey: def.key, deletedAt: null } });
    if (count > 0) throw new ConflictException(`${count} applicant(s) are in "${def.label}". Move them to another stage first.`);
    await this.db.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async assertSingleton(role: StageRole, exceptId: string | null) {
    if (!SINGLETON_ROLES.includes(role)) return;
    const existing = await this.db.findFirst({
      where: { role: role as any, ...(exceptId ? { id: { not: exceptId } } : {}) },
    });
    if (existing) throw new ConflictException(`The "${role}" role is already used by "${existing.label}". Each of these roles can be assigned to only one stage.`);
  }
}

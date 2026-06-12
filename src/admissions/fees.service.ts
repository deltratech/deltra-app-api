import { Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import {
  CreateDevFeeTierDto, CreateFeeScheduleDto, UpdateDevFeeTierDto, UpdateFeeScheduleDto,
} from './dto/fee.dto';
import { AdmissionSchoolLevel } from './admissions.enums';

const TERM_LABEL: Record<string, string> = {
  one_time: 'One-time', upon_registration: 'Upon registration', upon_admission: 'Upon admission',
  monthly: 'Monthly', per_term: 'Per term', per_semester: 'Per semester', yearly: 'Yearly',
};
const LEVEL_LABEL: Record<string, string> = { preschool: 'Pre-school', primary: 'Primary', secondary: 'Secondary' };

@Injectable()
export class FeesService {
  constructor(private readonly tenantPrisma: PrismaTenantService) {}

  private get schedules() { return this.tenantPrisma.client.admissionFeeSchedule; }
  private get tiers() { return this.tenantPrisma.client.admissionDevelopmentFeeTier; }

  // ── Fee schedules ────────────────────────────────────────────────────────
  listFeeSchedules(filters: { academicYear?: string; schoolLevel?: AdmissionSchoolLevel } = {}) {
    return this.schedules.findMany({
      where: {
        deletedAt: null,
        ...(filters.academicYear ? { academicYear: filters.academicYear } : {}),
        ...(filters.schoolLevel ? { schoolLevel: filters.schoolLevel } : {}),
      },
      orderBy: [{ schoolLevel: 'asc' }, { feeType: 'asc' }],
    });
  }

  createFeeSchedule(dto: CreateFeeScheduleDto) {
    return this.schedules.create({ data: { ...dto } });
  }

  async updateFeeSchedule(id: string, dto: UpdateFeeScheduleDto) {
    await this.findSchedule(id);
    return this.schedules.update({ where: { id }, data: { ...dto } });
  }

  async removeFeeSchedule(id: string) {
    await this.findSchedule(id);
    await this.schedules.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, deleted: true };
  }

  private async findSchedule(id: string) {
    const row = await this.schedules.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw new NotFoundException(`Fee schedule ${id} not found`);
    return row;
  }

  // ── Development-fee tiers ────────────────────────────────────────────────
  listDevTiers(filters: { academicYear?: string; schoolLevel?: AdmissionSchoolLevel } = {}) {
    return this.tiers.findMany({
      where: {
        deletedAt: null,
        ...(filters.academicYear ? { academicYear: filters.academicYear } : {}),
        ...(filters.schoolLevel ? { schoolLevel: filters.schoolLevel } : {}),
      },
      orderBy: [{ schoolLevel: 'asc' }, { gradeFromLabel: 'asc' }],
    });
  }

  createDevTier(dto: CreateDevFeeTierDto) {
    return this.tiers.create({ data: { ...dto } });
  }

  async updateDevTier(id: string, dto: UpdateDevFeeTierDto) {
    await this.findTier(id);
    return this.tiers.update({ where: { id }, data: { ...dto } });
  }

  async removeDevTier(id: string) {
    await this.findTier(id);
    await this.tiers.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, deleted: true };
  }

  private async findTier(id: string) {
    const row = await this.tiers.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw new NotFoundException(`Development-fee tier ${id} not found`);
    return row;
  }

  /** Fees that apply to a given application — used to build an invoice. */
  async applicableFor(applicationId: string) {
    const app = await this.tenantPrisma.client.admissionApplication.findFirst({
      where: { id: applicationId, deletedAt: null },
    });
    if (!app) throw new NotFoundException(`Application ${applicationId} not found`);

    const feeSchedules = await this.schedules.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        academicYear: app.academicYear,
        schoolLevel: app.schoolLevel,
        AND: [
          { OR: [{ gradeLabel: null }, { gradeLabel: app.gradeLabel }] },
          { OR: [{ studentCategory: null }, { studentCategory: app.studentCategory }] },
        ],
      },
      orderBy: { feeType: 'asc' },
    });

    const devFeeTiers = await this.tiers.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        academicYear: app.academicYear,
        schoolLevel: app.schoolLevel,
        // app.gradeLabel may hold either an entry grade or the chosen package (durationLabel).
        AND: [
          { OR: [{ gradeFromLabel: app.gradeLabel }, { durationLabel: app.gradeLabel }] },
          { OR: [{ studentCategory: null }, { studentCategory: app.studentCategory }] },
        ],
      },
      orderBy: { amount: 'asc' },
    });

    return { feeSchedules, devFeeTiers };
  }

  /** Build an .xlsx workbook of all configured fees + dev-fee packages for a year. */
  async exportWorkbook(academicYear?: string): Promise<Buffer> {
    const [fees, tiers] = await Promise.all([
      this.listFeeSchedules({ academicYear }),
      this.listDevTiers({ academicYear }),
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Deltra PPDB';

    const styleHeader = (row: ExcelJS.Row) => {
      row.font = { bold: true, color: { argb: 'FF0E5247' } };
      row.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5F1' } }; });
    };

    const feeSheet = wb.addWorksheet('Fee Schedules');
    feeSheet.columns = [
      { header: 'School level', key: 'level', width: 14 },
      { header: 'Grade', key: 'grade', width: 14 },
      { header: 'Category', key: 'category', width: 16 },
      { header: 'Fee', key: 'fee', width: 28 },
      { header: 'Payment term', key: 'term', width: 18 },
      { header: 'Amount (IDR)', key: 'amount', width: 18 },
      { header: 'Academic year', key: 'year', width: 16 },
    ];
    styleHeader(feeSheet.getRow(1));
    for (const f of fees) {
      feeSheet.addRow({
        level: LEVEL_LABEL[f.schoolLevel] ?? f.schoolLevel,
        grade: f.gradeLabel ?? 'All grades',
        category: f.studentCategory ? f.studentCategory.replace(/_/g, ' ') : 'All categories',
        fee: f.label || f.feeType,
        term: TERM_LABEL[f.paymentTerm] ?? f.paymentTerm,
        amount: f.amount,
        year: f.academicYear,
      });
    }
    feeSheet.getColumn('amount').numFmt = '#,##0';

    const tierSheet = wb.addWorksheet('Development-Fee Packages');
    tierSheet.columns = [
      { header: 'School level', key: 'level', width: 14 },
      { header: 'Package', key: 'pkg', width: 28 },
      { header: 'Entry grade', key: 'from', width: 14 },
      { header: 'To grade', key: 'to', width: 14 },
      { header: 'Category', key: 'category', width: 16 },
      { header: 'Payment term', key: 'term', width: 18 },
      { header: 'Amount (IDR)', key: 'amount', width: 18 },
      { header: 'Academic year', key: 'year', width: 16 },
    ];
    styleHeader(tierSheet.getRow(1));
    for (const t of tiers) {
      tierSheet.addRow({
        level: LEVEL_LABEL[t.schoolLevel] ?? t.schoolLevel,
        pkg: t.durationLabel,
        from: t.gradeFromLabel,
        to: t.gradeToLabel ?? '',
        category: t.studentCategory ? t.studentCategory.replace(/_/g, ' ') : 'All categories',
        term: TERM_LABEL[t.paymentTerm] ?? t.paymentTerm,
        amount: t.amount,
        year: t.academicYear,
      });
    }
    tierSheet.getColumn('amount').numFmt = '#,##0';

    return Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
  }
}

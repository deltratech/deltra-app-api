import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { StorageService } from '../storage/storage.service';
import { paginatedResult } from '../common/utils/paginate';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { AssignTestDto, DecisionDto, RecordResultDto } from './dto/transition.dto';
import { BulkTransitionDto } from './dto/bulk-transition.dto';
import { VerifyDocumentDto } from './dto/document.dto';
import {
  AdmissionDocStatus, AdmissionDocType, AdmissionKfStatusSource, AdmissionSchoolLevel,
  AdmissionStage, AdmissionStudentCategory,
} from './admissions.enums';

const DOC_SELECT = {
  id: true, documentType: true, fileName: true, fileUrl: true, status: true, uploadedAt: true,
} as const;

/** Document-completeness rollup shown in the applicants table. */
function documentsStatus(docs: { status: string }[]): 'complete' | 'pending' | 'missing' {
  if (docs.length === 0) return 'pending';
  if (docs.some((d) => d.status === AdmissionDocStatus.rejected)) return 'missing';
  return docs.every((d) => d.status === AdmissionDocStatus.verified) ? 'complete' : 'pending';
}

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly tenantPrisma: PrismaTenantService,
    private readonly storage: StorageService,
  ) {}

  private get db() { return this.tenantPrisma.client.admissionApplication; }

  private decorate<T extends { documents?: { status: string }[]; enrolledAt?: Date | null; blockedAt?: Date | null }>(app: T) {
    const docs = app.documents ?? [];
    return { ...app, documentsStatus: documentsStatus(docs), enrolled: !!app.enrolledAt, blocked: !!app.blockedAt };
  }

  /** Shared where-builder for application filters (list + bulk). */
  private buildApplicationWhere(filters: {
    stage?: AdmissionStage; schoolLevel?: AdmissionSchoolLevel; academicYear?: string; search?: string;
  }) {
    const { stage, schoolLevel, academicYear, search } = filters;
    return {
      deletedAt: null,
      ...(stage ? { stage } : {}),
      ...(schoolLevel ? { schoolLevel } : {}),
      ...(academicYear ? { academicYear } : {}),
      ...(search ? {
        OR: [
          { applicantName: { contains: search, mode: 'insensitive' as const } },
          { applicationNo: { contains: search, mode: 'insensitive' as const } },
          { guardianName:  { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };
  }

  async findAll(filters: {
    stage?: AdmissionStage; schoolLevel?: AdmissionSchoolLevel; academicYear?: string;
    search?: string; page?: number; limit?: number;
  } = {}) {
    const { page = 1, limit = 20 } = filters;
    const where = this.buildApplicationWhere(filters);
    const [data, total] = await Promise.all([
      this.db.findMany({
        where,
        include: { documents: { select: DOC_SELECT } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.count({ where }),
    ]);
    return paginatedResult(data.map((a) => this.decorate(a)), total, page, limit);
  }

  /** Export all applicants matching the filter as an .xlsx workbook. */
  async exportWorkbook(filters: {
    stage?: AdmissionStage; schoolLevel?: AdmissionSchoolLevel; academicYear?: string; search?: string;
  } = {}) {
    const rows = await this.db.findMany({
      where: this.buildApplicationWhere(filters),
      include: { documents: { select: { status: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const stageLabel: Record<string, string> = {
      applied: 'Applied', kf_pending: 'KF pending', document_review: 'Document review', tested: 'Tested',
      passed: 'Passed', failed: 'Failed', offer_pending: 'Offer pending', accepted: 'Accepted',
      enrolled: 'Enrolled', rejected: 'Rejected',
    };
    const levelLabel: Record<string, string> = { preschool: 'Pre-school', primary: 'Primary', secondary: 'Secondary' };

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Deltra PPDB';
    const ws = wb.addWorksheet('Applicants');
    ws.columns = [
      { header: 'No.', key: 'no', width: 16 },
      { header: 'Applicant', key: 'name', width: 26 },
      { header: 'NIK', key: 'nik', width: 20 },
      { header: 'School level', key: 'level', width: 14 },
      { header: 'Grade / package', key: 'grade', width: 22 },
      { header: 'Academic year', key: 'year', width: 14 },
      { header: 'Stage', key: 'stage', width: 16 },
      { header: 'Test score', key: 'score', width: 11 },
      { header: 'Documents', key: 'docs', width: 12 },
      { header: 'Category', key: 'category', width: 14 },
      { header: 'Guardian', key: 'guardian', width: 22 },
      { header: 'Guardian phone', key: 'phone', width: 18 },
      { header: 'Guardian email', key: 'email', width: 26 },
      { header: 'Enrolled', key: 'enrolled', width: 10 },
      { header: 'Registered', key: 'created', width: 14 },
    ];
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FF0E5247' } };
    head.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5F1' } }; });

    for (const a of rows) {
      ws.addRow({
        no: a.applicationNo ?? '',
        name: a.applicantName,
        nik: a.applicantNik ?? '',
        level: levelLabel[a.schoolLevel] ?? a.schoolLevel,
        grade: a.gradeLabel,
        year: a.academicYear,
        stage: stageLabel[a.stage] ?? a.stage,
        score: a.testScore ?? '',
        docs: documentsStatus(a.documents),
        category: a.studentCategory ? a.studentCategory.replace(/_/g, ' ') : '',
        guardian: a.guardianName ?? '',
        phone: a.guardianPhone ?? '',
        email: a.guardianEmail ?? '',
        enrolled: a.enrolledAt ? 'Yes' : 'No',
        created: a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : '',
      });
    }
    return Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
  }

  /** Stage counts + rollups for the pipeline + stats cards. */
  async stats(filters: { academicYear?: string; schoolLevel?: AdmissionSchoolLevel } = {}) {
    const where = {
      deletedAt: null,
      ...(filters.academicYear ? { academicYear: filters.academicYear } : {}),
      ...(filters.schoolLevel ? { schoolLevel: filters.schoolLevel } : {}),
    };
    const grouped = await this.db.groupBy({ by: ['stage'], where, _count: { _all: true } });
    const byStage = Object.fromEntries(
      Object.values(AdmissionStage).map((s) => [s, 0]),
    ) as Record<AdmissionStage, number>;
    for (const g of grouped) byStage[g.stage as AdmissionStage] = g._count._all;

    const total = Object.values(byStage).reduce((a, b) => a + b, 0);
    const underReview = byStage.applied + byStage.kf_pending + byStage.document_review
      + byStage.tested + byStage.passed + byStage.offer_pending;
    const accepted = byStage.accepted + byStage.enrolled;
    return { total, underReview, accepted, enrolled: byStage.enrolled, rejected: byStage.rejected, byStage };
  }

  async findOne(id: string) {
    const app = await this.db.findFirst({
      where: { id, deletedAt: null },
      include: { documents: { select: DOC_SELECT, orderBy: { uploadedAt: 'desc' } } },
    });
    if (!app) throw new NotFoundException(`Application ${id} not found`);
    return this.decorate(app);
  }

  /** Short, unambiguous access code (no 0/O/1/I/L) for lookup-by-number. */
  private generateTrackingCode(len = 6) {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(len);
    let out = '';
    for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
    return out;
  }

  async create(dto: CreateApplicationDto) {
    const isPreschool = dto.schoolLevel === AdmissionSchoolLevel.preschool;
    const seq = await this.db.count({ where: { academicYear: dto.academicYear } });
    const applicationNo = `APP-${dto.academicYear.split('-')[0]}-${String(seq + 1).padStart(4, '0')}`;

    const app = await this.db.create({
      data: {
        applicationNo,
        publicToken: randomUUID().replace(/-/g, ''),
        trackingCode: this.generateTrackingCode(),
        applicantName: dto.applicantName,
        applicantNik: dto.applicantNik,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        gender: dto.gender,
        guardianName: dto.guardianName,
        guardianPhone: dto.guardianPhone,
        guardianEmail: dto.guardianEmail,
        schoolLevel: dto.schoolLevel,
        gradeLabel: dto.gradeLabel,
        academicYear: dto.academicYear,
        studentCategory: dto.studentCategory
          ?? (isPreschool ? AdmissionStudentCategory.not_applicable : AdmissionStudentCategory.non_kf),
        kfStatusSource: isPreschool
          ? AdmissionKfStatusSource.not_applicable : AdmissionKfStatusSource.unverified,
        stage: dto.stage ?? AdmissionStage.applied,
        testScore: dto.testScore,
        notes: dto.notes,
      },
      include: { documents: { select: DOC_SELECT } },
    });
    return this.decorate(app);
  }

  async update(id: string, dto: UpdateApplicationDto) {
    await this.findOne(id);
    const app = await this.db.update({
      where: { id },
      data: {
        applicantName: dto.applicantName,
        applicantNik: dto.applicantNik,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        gender: dto.gender,
        guardianName: dto.guardianName,
        guardianPhone: dto.guardianPhone,
        guardianEmail: dto.guardianEmail,
        schoolLevel: dto.schoolLevel,
        gradeLabel: dto.gradeLabel,
        academicYear: dto.academicYear,
        studentCategory: dto.studentCategory,
        stage: dto.stage,
        testScore: dto.testScore,
        notes: dto.notes,
      },
      include: { documents: { select: DOC_SELECT } },
    });
    return this.decorate(app);
  }

  async assignTest(id: string, dto: AssignTestDto) {
    await this.findOne(id);
    const app = await this.db.update({
      where: { id },
      data: { testDate: new Date(dto.testDate), stage: AdmissionStage.tested },
      include: { documents: { select: DOC_SELECT } },
    });
    return this.decorate(app);
  }

  async recordResult(id: string, dto: RecordResultDto) {
    await this.findOne(id);
    const app = await this.db.update({
      where: { id },
      data: {
        testScore: dto.testScore,
        resultNotes: dto.resultNotes,
        resultDate: new Date(),
        stage: dto.passed ? AdmissionStage.passed : AdmissionStage.failed,
      },
      include: { documents: { select: DOC_SELECT } },
    });
    return this.decorate(app);
  }

  async decide(id: string, dto: DecisionDto) {
    await this.findOne(id);
    const app = await this.db.update({
      where: { id },
      data: {
        stage: dto.accepted ? AdmissionStage.accepted : AdmissionStage.rejected,
        resultNotes: dto.resultNotes,
        resultDate: new Date(),
      },
      include: { documents: { select: DOC_SELECT } },
    });
    return this.decorate(app);
  }

  async enroll(id: string) {
    const current = await this.findOne(id);
    if (current.enrolled) return current;
    const app = await this.db.update({
      where: { id },
      data: { stage: AdmissionStage.enrolled, enrolledAt: new Date() },
      include: { documents: { select: DOC_SELECT } },
    });
    return this.decorate(app);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, deleted: true };
  }

  /** Block (put on hold) or unblock an application — an impediment flag, stage unchanged. */
  async setBlocked(id: string, blocked: boolean, reason?: string) {
    await this.findOne(id);
    const app = await this.db.update({
      where: { id },
      data: {
        blockedAt: blocked ? new Date() : null,
        blockReason: blocked ? (reason?.trim() || null) : null,
      },
      include: { documents: { select: DOC_SELECT } },
    });
    return this.decorate(app);
  }

  /** Apply one stage transition to many applications at once (by ids or by filter). */
  async bulkTransition(dto: BulkTransitionDto) {
    const hasIds = Array.isArray(dto.ids) && dto.ids.length > 0;
    const filter = dto.filter ?? {};
    const hasScope = !!filter.academicYear || !!filter.stage || !!filter.search;
    if (!hasIds && !hasScope) {
      throw new BadRequestException('Provide ids, or a filter with at least an academicYear, stage, or search');
    }
    const where = hasIds
      ? { id: { in: dto.ids! }, deletedAt: null }
      : this.buildApplicationWhere(filter);

    let data: Record<string, unknown>;
    switch (dto.action) {
      case 'assign_test':
        if (!dto.testDate) throw new BadRequestException('testDate is required for assign_test');
        data = { testDate: new Date(dto.testDate), stage: AdmissionStage.tested };
        break;
      case 'record_result':
        data = {
          stage: dto.passed ? AdmissionStage.passed : AdmissionStage.failed,
          resultDate: new Date(),
          ...(dto.testScore != null ? { testScore: dto.testScore } : {}),
        };
        break;
      case 'decision':
        data = {
          stage: dto.accepted ? AdmissionStage.accepted : AdmissionStage.rejected,
          resultDate: new Date(),
        };
        break;
      case 'send_offer':
        data = { stage: AdmissionStage.offer_pending };
        break;
      case 'enroll':
        data = { stage: AdmissionStage.enrolled, enrolledAt: new Date() };
        break;
      case 'set_stage':
        if (!dto.stage) throw new BadRequestException('stage is required for set_stage');
        data = { stage: dto.stage };
        break;
      case 'block':
        data = { blockedAt: new Date(), blockReason: dto.reason?.trim() || null };
        break;
      case 'unblock':
        data = { blockedAt: null, blockReason: null };
        break;
      default:
        throw new BadRequestException('Unknown bulk action');
    }

    const res = await this.db.updateMany({ where, data: data as any });
    return { updated: res.count };
  }

  // ── Level settings (test gate / cut-off / grades) ────────────────────────────
  private defaultSetting(schoolLevel: AdmissionSchoolLevel) {
    const grades: Record<AdmissionSchoolLevel, string[]> = {
      [AdmissionSchoolLevel.preschool]: ['Toddler', 'K1', 'K2', 'KG A', 'KG B'],
      [AdmissionSchoolLevel.primary]: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
      [AdmissionSchoolLevel.secondary]: ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
    };
    return {
      schoolLevel,
      hasTestGate: schoolLevel !== AdmissionSchoolLevel.preschool, // pre-school = direct admission
      enrollmentCutoff: null as Date | null,
      gradeLabels: grades[schoolLevel],
    };
  }

  /** All three levels, each merged with stored overrides (or sensible defaults). */
  async listLevelSettings() {
    const rows = await this.tenantPrisma.client.admissionLevelSetting.findMany();
    const byLevel = new Map(rows.map((r) => [r.schoolLevel as AdmissionSchoolLevel, r]));
    return Object.values(AdmissionSchoolLevel).map((lvl) => {
      const d = this.defaultSetting(lvl);
      const row = byLevel.get(lvl);
      if (!row) return d;
      const grades = Array.isArray(row.gradeLabels) ? (row.gradeLabels as string[]) : d.gradeLabels;
      return {
        schoolLevel: lvl,
        hasTestGate: row.hasTestGate,
        enrollmentCutoff: row.enrollmentCutoff,
        gradeLabels: grades.length ? grades : d.gradeLabels,
      };
    });
  }

  async getLevelSetting(schoolLevel: AdmissionSchoolLevel) {
    const row = await this.tenantPrisma.client.admissionLevelSetting.findUnique({ where: { schoolLevel } });
    if (!row) return this.defaultSetting(schoolLevel);
    const d = this.defaultSetting(schoolLevel);
    const grades = Array.isArray(row.gradeLabels) ? (row.gradeLabels as string[]) : d.gradeLabels;
    return {
      schoolLevel, hasTestGate: row.hasTestGate, enrollmentCutoff: row.enrollmentCutoff,
      gradeLabels: grades.length ? grades : d.gradeLabels,
    };
  }

  // ── Documents ──────────────────────────────────────────────────────────────
  async listDocuments(applicationId: string) {
    await this.findOne(applicationId);
    return this.tenantPrisma.client.admissionDocument.findMany({
      where: { applicationId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  /** Review queue: documents across all applications, with applicant context. */
  async listDocumentQueue(filters: { status?: AdmissionDocStatus } = {}) {
    const docs = await this.tenantPrisma.client.admissionDocument.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        application: { deletedAt: null },
      },
      orderBy: { uploadedAt: 'desc' },
      include: {
        application: {
          select: { id: true, applicantName: true, applicationNo: true, gradeLabel: true, stage: true },
        },
      },
    });
    return docs;
  }

  /** Upload a document file to storage and attach it to an application. */
  async addDocumentFile(
    applicationId: string,
    documentType: AdmissionDocType,
    file: Express.Multer.File,
    tenantSlug: string,
  ) {
    await this.findOne(applicationId);
    const fileUrl = await this.storage.upload(
      file.buffer, file.originalname, file.mimetype, 'admission-documents', tenantSlug,
    );
    return this.tenantPrisma.client.admissionDocument.create({
      data: { applicationId, documentType, fileUrl, fileName: file.originalname },
    });
  }

  async verifyDocument(documentId: string, dto: VerifyDocumentDto, actor: { userId: string }) {
    const doc = await this.tenantPrisma.client.admissionDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException(`Document ${documentId} not found`);

    const updated = await this.tenantPrisma.client.admissionDocument.update({
      where: { id: documentId },
      data: {
        status: dto.status,
        notes: dto.notes,
        verifiedById: actor.userId,
        verifiedAt: new Date(),
      },
    });

    // KF gate: verifying/rejecting a `kf_proof` resolves an applicant sitting in kf_pending.
    if (doc.documentType === AdmissionDocType.kf_proof) {
      const app = await this.db.findFirst({ where: { id: doc.applicationId, deletedAt: null } });
      if (app && app.stage === AdmissionStage.kf_pending) {
        const verified = dto.status === AdmissionDocStatus.verified;
        await this.db.update({
          where: { id: app.id },
          data: {
            kfStatusSource: AdmissionKfStatusSource.manual_verified,
            studentCategory: verified ? AdmissionStudentCategory.kf_student : AdmissionStudentCategory.non_kf,
            stage: AdmissionStage.applied,
          },
        });
      }
    }
    return updated;
  }
}

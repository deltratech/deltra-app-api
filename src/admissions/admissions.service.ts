import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { StorageService } from '../storage/storage.service';
import { paginatedResult } from '../common/utils/paginate';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { AssignTestDto, DecisionDto, RecordResultDto } from './dto/transition.dto';
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

  private decorate<T extends { documents?: { status: string }[]; enrolledAt?: Date | null }>(app: T) {
    const docs = app.documents ?? [];
    return { ...app, documentsStatus: documentsStatus(docs), enrolled: !!app.enrolledAt };
  }

  async findAll(filters: {
    stage?: AdmissionStage; schoolLevel?: AdmissionSchoolLevel; academicYear?: string;
    search?: string; page?: number; limit?: number;
  } = {}) {
    const { stage, schoolLevel, academicYear, search, page = 1, limit = 20 } = filters;
    const where = {
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

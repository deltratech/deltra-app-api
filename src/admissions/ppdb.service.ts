import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { AdmissionsService } from './admissions.service';
import { FeesService } from './fees.service';
import { CreatePpdbFormDto, PublicSubmitDto, UpdatePpdbFormDto } from './dto/ppdb.dto';
import { AdmissionSchoolLevel, AdmissionStage, AdmissionDocType } from './admissions.enums';
import { getTenantContext } from '../tenant/tenant.context';
import {
  DEFAULT_FIELDS, DEFAULT_REQUIRED_DOCS, type PpdbField, type PpdbRequiredDoc,
} from './ppdb-form.defaults';

@Injectable()
export class PpdbService {
  constructor(
    private readonly tenantPrisma: PrismaTenantService,
    private readonly admissions: AdmissionsService,
    private readonly fees: FeesService,
  ) {}

  private get forms() { return this.tenantPrisma.client.ppdbForm; }
  private get apps() { return this.tenantPrisma.client.admissionApplication; }

  /** Fill the form's config with defaults when it hasn't been customised yet. */
  private withConfig<T extends { fieldsJson?: unknown; requiredDocumentsJson?: unknown }>(form: T) {
    const f = form.fieldsJson;
    const d = form.requiredDocumentsJson;
    const fields = Array.isArray(f) && f.length ? (f as PpdbField[]) : DEFAULT_FIELDS;
    const requiredDocuments = Array.isArray(d) && d.length ? (d as PpdbRequiredDoc[]) : DEFAULT_REQUIRED_DOCS;
    return { ...form, fields, requiredDocuments };
  }

  /** The form for a given year (or null), with config defaulted. */
  async getForm(academicYear: string) {
    const form = await this.forms.findFirst({ where: { academicYear, deletedAt: null } });
    return form ? this.withConfig(form) : null;
  }

  async createForm(dto: CreatePpdbFormDto) {
    const existing = await this.forms.findFirst({ where: { academicYear: dto.academicYear, deletedAt: null } });
    if (existing) return this.withConfig(existing);
    const form = await this.forms.create({
      data: {
        token: randomUUID().replace(/-/g, ''),
        academicYear: dto.academicYear,
        title: dto.title?.trim() || `Pendaftaran Peserta Didik Baru ${dto.academicYear}`,
        isOpen: true,
        fieldsJson: DEFAULT_FIELDS as any,
        requiredDocumentsJson: DEFAULT_REQUIRED_DOCS as any,
      },
    });
    return this.withConfig(form);
  }

  /** Normalise + validate a custom link slug, ensuring it doesn't collide with any token/slug. */
  private async resolveSlug(raw: string, selfId: string): Promise<string | null> {
    const slug = raw.trim().toLowerCase();
    if (!slug) return null;
    if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(slug)) {
      throw new BadRequestException('Link must be 3–40 chars: lowercase letters, numbers, and hyphens');
    }
    if (slug === 'track' || slug === 'status') {
      throw new BadRequestException(`"${slug}" is reserved`);
    }
    const clash = await this.forms.findFirst({
      where: { OR: [{ token: slug }, { slug }], NOT: { id: selfId }, deletedAt: null },
      select: { id: true },
    });
    if (clash) throw new BadRequestException('That link is already taken');
    return slug;
  }

  async updateForm(id: string, dto: UpdatePpdbFormDto) {
    const existing = await this.forms.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException(`PPDB form ${id} not found`);
    const slug = dto.slug === undefined ? undefined
      : dto.slug === null || dto.slug.trim() === '' ? null
      : await this.resolveSlug(dto.slug, id);
    const form = await this.forms.update({
      where: { id },
      data: {
        ...(dto.isOpen !== undefined ? { isOpen: dto.isOpen } : {}),
        ...(dto.title !== undefined ? { title: dto.title?.trim() || existing.title } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.fields !== undefined ? { fieldsJson: dto.fields as any } : {}),
        ...(dto.requiredDocuments !== undefined ? { requiredDocumentsJson: dto.requiredDocuments as any } : {}),
        ...(dto.paymentInstructions !== undefined ? { paymentInstructions: dto.paymentInstructions?.trim() || null } : {}),
        ...(dto.acceptanceLetter !== undefined ? { acceptanceLetter: dto.acceptanceLetter?.trim() || null } : {}),
      },
    });
    return this.withConfig(form);
  }

  /** Public, no-auth: resolve a form by its share token OR custom slug (+ levels/grades). */
  async getPublicByToken(tokenOrSlug: string) {
    const form = await this.forms.findFirst({ where: { OR: [{ token: tokenOrSlug }, { slug: tokenOrSlug }], deletedAt: null } });
    if (!form) throw new NotFoundException('Registration form not found');
    const cfg = this.withConfig(form);
    const [settings, feeSchedules, devFeeTiers] = await Promise.all([
      this.admissions.listLevelSettings(),
      this.fees.listFeeSchedules({ academicYear: form.academicYear }),
      this.fees.listDevTiers({ academicYear: form.academicYear }),
    ]);
    return {
      token: form.token,
      academicYear: form.academicYear,
      title: form.title,
      description: form.description,
      isOpen: form.isOpen,
      fields: cfg.fields,
      requiredDocuments: cfg.requiredDocuments,
      levels: settings.map((s) => ({ schoolLevel: s.schoolLevel, gradeLabels: s.gradeLabels })),
      fees: {
        feeSchedules: feeSchedules.filter((f) => f.isActive).map((f) => ({
          id: f.id, schoolLevel: f.schoolLevel, gradeLabel: f.gradeLabel, studentCategory: f.studentCategory,
          feeType: f.feeType, amount: f.amount, paymentTerm: f.paymentTerm, label: f.label,
        })),
        devFeeTiers: devFeeTiers.filter((t) => t.isActive).map((t) => ({
          id: t.id, schoolLevel: t.schoolLevel, studentCategory: t.studentCategory, durationLabel: t.durationLabel,
          gradeFromLabel: t.gradeFromLabel, gradeToLabel: t.gradeToLabel, amount: t.amount, paymentTerm: t.paymentTerm,
        })),
      },
    };
  }

  /** Public, no-auth: create an application from a public submission. */
  async submitPublic(token: string, dto: PublicSubmitDto) {
    const form = await this.forms.findFirst({ where: { OR: [{ token }, { slug: token }], deletedAt: null } });
    if (!form) throw new NotFoundException('Registration form not found');
    if (!form.isOpen) throw new ForbiddenException('Registration is currently closed');

    const setting = await this.admissions.getLevelSetting(dto.schoolLevel);
    if (setting.enrollmentCutoff && new Date() > setting.enrollmentCutoff) {
      throw new ForbiddenException('The enrollment cut-off date for this level has passed');
    }

    // Auto-accept when there's no test gate (pre-school direct admission); otherwise
    // primary/secondary applicants land in kf_pending until KF status is resolved.
    const isPreschool = dto.schoolLevel === AdmissionSchoolLevel.preschool;
    const stage = !setting.hasTestGate
      ? AdmissionStage.accepted
      : (isPreschool ? AdmissionStage.applied : AdmissionStage.kf_pending);

    const app = await this.admissions.create({
      applicantName: dto.applicantName,
      applicantNik: dto.applicantNik,
      birthDate: dto.birthDate,
      gender: dto.gender,
      guardianName: dto.guardianName,
      guardianPhone: dto.guardianPhone,
      guardianEmail: dto.guardianEmail,
      schoolLevel: dto.schoolLevel,
      gradeLabel: dto.gradeLabel,
      academicYear: form.academicYear,
      stage,
    });
    if (dto.formData && Object.keys(dto.formData).length) {
      await this.apps.update({ where: { id: app.id }, data: { formDataJson: dto.formData as any } });
    }
    return {
      applicationNo: app.applicationNo,
      applicantName: app.applicantName,
      trackingToken: app.publicToken,
      trackingCode: app.trackingCode,
    };
  }

  /** Public, no-auth: resolve an application's tracking link from its number + access code. */
  async lookup(applicationNo: string, code: string) {
    const no = (applicationNo ?? '').trim();
    const c = (code ?? '').trim().toUpperCase();
    if (!no || !c) throw new BadRequestException('Registration number and access code are required');
    const app = await this.apps.findFirst({
      where: { applicationNo: { equals: no, mode: 'insensitive' }, deletedAt: null },
      select: { trackingCode: true, publicToken: true },
    });
    if (!app || !app.trackingCode || app.trackingCode.toUpperCase() !== c || !app.publicToken) {
      throw new NotFoundException('No application matches that number and code');
    }
    return { trackingToken: app.publicToken };
  }

  // ── Parent tracking portal (no-auth, by application publicToken) ─────────────
  private async findByPublicToken(token: string) {
    const app = await this.apps.findFirst({ where: { publicToken: token, deletedAt: null } });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  /** Parent-facing status view: stage, documents, invoices, and (if offered) packages. */
  async getStatus(token: string) {
    const app = await this.apps.findFirst({
      where: { publicToken: token, deletedAt: null },
      include: {
        documents: { select: { id: true, documentType: true, requirementKey: true, label: true, fileName: true, status: true, uploadedAt: true }, orderBy: { uploadedAt: 'desc' } },
        invoices: { where: { deletedAt: null }, include: { items: true }, orderBy: { issuedAt: 'desc' } },
      },
    });
    if (!app) throw new NotFoundException('Application not found');

    // When an offer is pending, surface the dev-fee packages the parent may choose from.
    let packages: Array<{ id: string; durationLabel: string; amount: number; studentCategory: string | null }> = [];
    if (app.stage === AdmissionStage.offer_pending) {
      const { devFeeTiers } = await this.fees.applicableFor(app.id);
      packages = devFeeTiers.map((t) => ({ id: t.id, durationLabel: t.durationLabel, amount: t.amount, studentCategory: t.studentCategory }));
    }

    // Required-document checklist + payment instructions from this year's form (defaulted).
    const form = await this.forms.findFirst({ where: { academicYear: app.academicYear, deletedAt: null } });
    const requiredDocuments = form ? this.withConfig(form).requiredDocuments : DEFAULT_REQUIRED_DOCS;
    const paymentInstructions = form?.paymentInstructions ?? null;

    return {
      applicantName: app.applicantName,
      applicationNo: app.applicationNo,
      trackingCode: app.trackingCode,
      paymentInstructions,
      schoolLevel: app.schoolLevel,
      gradeLabel: app.gradeLabel,
      academicYear: app.academicYear,
      stage: app.stage,
      testDate: app.testDate,
      selectedDevFeeTierId: app.selectedDevFeeTierId,
      needsKfProof: app.stage === AdmissionStage.kf_pending,
      letter: app.letterUrl ? { url: app.letterUrl, issuedAt: app.letterIssuedAt } : null,
      documents: app.documents,
      requiredDocuments,
      invoices: app.invoices,
      packages,
    };
  }

  /** Parent uploads a supporting document, tagged to a required-document checklist item. */
  async uploadProof(
    token: string, file: Express.Multer.File,
    opts?: { documentType?: AdmissionDocType; requirementKey?: string; label?: string },
  ) {
    const app = await this.findByPublicToken(token);
    const tenantSlug = getTenantContext().tenantSlug;
    const doc = await this.admissions.addDocumentFile(
      app.id, opts?.documentType ?? AdmissionDocType.other, file, tenantSlug,
    );
    if (opts?.requirementKey || opts?.label) {
      return this.tenantPrisma.client.admissionDocument.update({
        where: { id: doc.id },
        data: { requirementKey: opts.requirementKey, label: opts.label },
      });
    }
    return doc;
  }

  /** Parent selects a development-fee package; confirms the offer. */
  async selectPackage(token: string, devFeeTierId: string) {
    const app = await this.findByPublicToken(token);
    if (app.stage !== AdmissionStage.offer_pending && app.stage !== AdmissionStage.accepted) {
      throw new BadRequestException('No package selection is open for this application');
    }
    const tier = await this.tenantPrisma.client.admissionDevelopmentFeeTier.findFirst({
      where: { id: devFeeTierId, deletedAt: null },
    });
    if (!tier) throw new NotFoundException('Package not found');
    await this.apps.update({
      where: { id: app.id },
      data: {
        selectedDevFeeTierId: devFeeTierId,
        ...(app.stage === AdmissionStage.offer_pending ? { stage: AdmissionStage.accepted } : {}),
      },
    });
    return { ok: true };
  }

  /** Parent reports they have paid an invoice; admin still confirms it. */
  async claimPayment(token: string, invoiceId: string) {
    const app = await this.findByPublicToken(token);
    const invoice = await this.tenantPrisma.client.admissionInvoice.findFirst({
      where: { id: invoiceId, applicationId: app.id, deletedAt: null },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    await this.tenantPrisma.client.admissionInvoice.update({
      where: { id: invoiceId },
      data: { paymentClaimedAt: new Date() },
    });
    return { ok: true };
  }
}

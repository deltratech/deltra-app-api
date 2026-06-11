import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { StorageService } from '../storage/storage.service';
import Docxtemplater from 'docxtemplater';
import { EmploymentStatus } from '../common/enums/employment-status.enum';
import PizZip from 'pizzip';
import { CreateContractTemplateDto } from './dto/create-contract-template.dto';
import {
  CreateTeacherContractDto,
  TeacherContractStatus,
} from './dto/create-teacher-contract.dto';
import { CreateUploadedTeacherContractDto } from './dto/create-uploaded-teacher-contract.dto';
import { PreviewTeacherContractDto } from './dto/preview-teacher-contract.dto';
import { UpdateContractTemplateDto } from './dto/update-contract-template.dto';
import { UpdateTeacherContractReminderDto } from './dto/update-teacher-contract-reminder.dto';
import { UpdateTeacherContractDto } from './dto/update-teacher-contract.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { DocumentCategory, getCategoryConfig, isCategoryEnabled, guessSlotRole, SIGNATURE_SLOT_ROLES, APPROVER_ROLES, RECIPIENT_TYPES } from './document-categories';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory, NotificationPriority, NotificationSourceType } from '../common/enums/notification.enum';
import { getTenantContext } from '../tenant/tenant.context';

type ActorContext = { userId: string; tenantSlug?: string; isSuperAdmin?: boolean; role?: string };
type EmploymentStatusLike = EmploymentStatus | `${EmploymentStatus}`;
type TemplateVariableMeta = {
  key: string;
  label: string;
  source: 'custom';
  required: boolean;
};

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

const PROFILE_INCLUDE = {
  user: { select: { id: true, fullName: true, email: true, phone: true } },
  classSubjects: {
    where: { classroom: { deletedAt: null }, subject: { deletedAt: null } },
    include: {
      subject: { select: { name: true } },
      classroom: { select: { name: true } },
    },
  },
} as const;

@Injectable()
export class TeacherContractsService {
  constructor(
    private readonly tenantPrisma: PrismaTenantService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  async createTemplate(dto: CreateContractTemplateDto, file: Express.Multer.File, actor: ActorContext) {
    this.assertCanCreate(actor);
    const existing = await this.tenantPrisma.client.teacherContractTemplate.findFirst({
      where: {
        deletedAt: null,
        name: dto.name,
        version: dto.version ?? 1,
      },
    });
    if (existing) throw new ConflictException('Template with same name and version already exists');

    const extractedVariableKeys = this.extractDocxVariableKeys(file.buffer);
    if (extractedVariableKeys.length === 0) throw new ConflictException('this file has no variable');

    const templateFileUrl = await this.storage.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      'teacher-contract-templates',
      'shared',
    );

    return this.tenantPrisma.client.teacherContractTemplate.create({
      data: {
        name: dto.name,
        category: (dto.category ?? null) as any,
        recipientType: this.normalizeRecipientType(dto.recipientType) ?? null,
        approverRolesJson: (this.parseApproverRoles(dto.approverRoles) ?? null) as any,
        variablesJson: extractedVariableKeys as any,
        signatureSlotsJson: (this.parseSignatureSlots(dto.signatureSlots)
          ?? this.extractSignatureSlots(file.buffer).map((key) => ({ key, role: guessSlotRole(key) }))) as any,
        templateFileUrl,
        templateFileName: file.originalname,
        templateMimeType: file.mimetype,
        templateSizeBytes: file.size,
        version: dto.version ?? 1,
        isActive: dto.isActive ?? true,
      } as any,
    });
  }

  findTemplates(filters: { isActive?: boolean; category?: DocumentCategory }) {
    return this.tenantPrisma.client.teacherContractTemplate.findMany({
      where: {
        deletedAt: null,
        ...(typeof filters.isActive === 'boolean' ? { isActive: filters.isActive } : {}),
        ...(filters.category ? { category: filters.category as any } : {}),
      },
      orderBy: [{ name: 'asc' }, { version: 'desc' }],
    });
  }

  async findTemplateOne(id: string) {
    const template = await this.tenantPrisma.client.teacherContractTemplate.findFirst({
      where: { id, deletedAt: null },
    });
    if (!template) throw new NotFoundException(`Contract template ${id} not found`);
    const keys = ((template.variablesJson as string[] | null) ?? []).filter((k) => typeof k === 'string');
    return {
      ...template,
      variables: keys.map((key) => this.toVariableMeta(key)),
    };
  }

  /** Extract the placeholder variable keys + detected signature slots from an uploaded DOCX. */
  inspectTemplateFile(file: Express.Multer.File) {
    const variables = this.extractDocxVariableKeys(file.buffer);
    if (variables.length === 0) throw new ConflictException('this file has no variable');
    const signatureSlots = this.extractSignatureSlots(file.buffer).map((key) => ({
      key,
      role: guessSlotRole(key),
    }));
    return { variables, signatureSlots, fileName: file.originalname, sizeBytes: file.size };
  }

  /**
   * Detect named signature slots in a DOCX: image tags `{%key}` whose name looks like a
   * signature (contains sign / ttd / tanda / paraf). Non-signature image tags (logo, kop) are ignored.
   */
  private extractSignatureSlots(buffer: Buffer): string[] {
    const zip = new PizZip(buffer);
    const textEntries = Object.keys(zip.files).filter((name) => name.startsWith('word/') && name.endsWith('.xml'));
    const pattern = /\{%\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}/g;
    const keys = new Set<string>();
    for (const entry of textEntries) {
      const text = this.getDocxXmlPlainText(zip.files[entry].asText());
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const key = match[1];
        if (/sign|ttd|tanda|paraf/i.test(key)) keys.add(key);
      }
    }
    return [...keys];
  }

  /** Parse + validate an approver-roles payload (JSON string or array) into a clean role list. */
  private parseApproverRoles(raw: unknown): string[] | undefined {
    if (raw === undefined || raw === null || raw === '') return undefined;
    let arr: unknown = raw;
    if (typeof raw === 'string') {
      try { arr = JSON.parse(raw); } catch { throw new BadRequestException('approverRoles must be valid JSON'); }
    }
    if (!Array.isArray(arr)) throw new BadRequestException('approverRoles must be an array');
    return [...new Set(arr.map((r) => String(r)).filter((r) => (APPROVER_ROLES as string[]).includes(r)))];
  }

  private normalizeRecipientType(raw: unknown): string | undefined {
    if (typeof raw !== 'string' || !raw) return undefined;
    return (RECIPIENT_TYPES as string[]).includes(raw) ? raw : undefined;
  }

  /** Parse + validate a signatureSlots payload (JSON string or array) into stored slot config. */
  private parseSignatureSlots(raw: unknown): Array<{ key: string; role: string; label?: string }> | undefined {
    if (raw === undefined || raw === null || raw === '') return undefined;
    let arr: unknown = raw;
    if (typeof raw === 'string') {
      try { arr = JSON.parse(raw); } catch { throw new BadRequestException('signatureSlots must be valid JSON'); }
    }
    if (!Array.isArray(arr)) throw new BadRequestException('signatureSlots must be an array');
    return arr
      .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
      .map((s) => ({
        key: String((s as any).key ?? '').trim(),
        role: String((s as any).role ?? 'principal'),
        ...((s as any).label ? { label: String((s as any).label) } : {}),
      }))
      .filter((s) => s.key.length > 0 && SIGNATURE_SLOT_ROLES.includes(s.role as any));
  }

  /** Render an uploaded (not-yet-saved) DOCX template to a PDF for preview. */
  async previewTemplateFile(file: Express.Multer.File): Promise<Buffer> {
    return this.convertDocxToPdf(file.buffer, file.originalname || 'template.docx');
  }

  /** Render a stored DOCX template to a PDF for preview (placeholders shown as-is). */
  async previewTemplateById(id: string): Promise<Buffer> {
    const template = await this.tenantPrisma.client.teacherContractTemplate.findFirst({
      where: { id, deletedAt: null },
    });
    if (!template) throw new NotFoundException(`Contract template ${id} not found`);
    if (!template.templateFileUrl) throw new BadRequestException('Template has no DOCX file');
    const buffer = await this.storage.read(template.templateFileUrl);
    return this.convertDocxToPdf(buffer, template.templateFileName || 'template.docx');
  }

  async updateTemplate(id: string, dto: UpdateContractTemplateDto, file: Express.Multer.File | undefined, actor: ActorContext) {
    this.assertCanCreate(actor);
    const existing = await this.tenantPrisma.client.teacherContractTemplate.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException(`Contract template ${id} not found`);

    let filePatch:
      | {
          templateFileUrl: string;
          templateFileName: string;
          templateMimeType: string;
          templateSizeBytes: number;
        }
      | undefined;

    if (file) {
      const extractedVariableKeys = this.extractDocxVariableKeys(file.buffer);
      if (extractedVariableKeys.length === 0) throw new ConflictException('this file has no variable');
      const newTemplateFileUrl = await this.storage.upload(
        file.buffer,
        file.originalname,
        file.mimetype,
        'teacher-contract-templates',
        'shared',
      );
      const existingTemplateFileUrl = (existing as any).templateFileUrl as string | undefined;
      if (existingTemplateFileUrl) await this.storage.delete(existingTemplateFileUrl);
      filePatch = {
        templateFileUrl: newTemplateFileUrl,
        templateFileName: file.originalname,
        templateMimeType: file.mimetype,
        templateSizeBytes: file.size,
      };
    }

    return this.tenantPrisma.client.teacherContractTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.category !== undefined ? { category: dto.category as any } : {}),
        ...(dto.recipientType !== undefined ? { recipientType: this.normalizeRecipientType(dto.recipientType) ?? null } : {}),
        ...(dto.approverRoles !== undefined ? { approverRolesJson: (this.parseApproverRoles(dto.approverRoles) ?? null) as any } : {}),
        ...(dto.version !== undefined ? { version: dto.version } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(file ? { variablesJson: this.extractDocxVariableKeys(file.buffer) as any } : {}),
        ...(this.parseSignatureSlots(dto.signatureSlots) !== undefined
          ? { signatureSlotsJson: this.parseSignatureSlots(dto.signatureSlots) as any }
          : file
            ? { signatureSlotsJson: this.extractSignatureSlots(file.buffer).map((key) => ({ key, role: guessSlotRole(key) })) as any }
            : {}),
        ...(filePatch ?? {}),
      },
    });
  }

  async removeTemplate(id: string, actor: ActorContext) {
    this.assertCanCreate(actor);
    const template = await this.findTemplateOne(id);
    if (template.templateFileUrl) await this.storage.delete(template.templateFileUrl);
    return this.tenantPrisma.client.teacherContractTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async preview(dto: PreviewTeacherContractDto) {
    const payload = await this.buildRenderedContract(dto);
    if (!payload.template?.templateFileUrl) {
      throw new BadRequestException('Selected template has no DOCX file');
    }
    const renderedDocxBuffer = await this.renderDocxTemplate(
      payload.template.templateFileUrl,
      payload.variables,
      { skipMissingSignatureImages: true },
    );
    return this.convertDocxToPdf(renderedDocxBuffer.buffer, 'contract-preview.docx');
  }

  async create(dto: CreateTeacherContractDto, actor: ActorContext) {
    this.assertCanCreate(actor);
    if (!dto.templateId) {
      throw new BadRequestException('templateId is required to generate a contract from DOCX template');
    }
    const payload = await this.buildRenderedContract(dto);
    const start = new Date(dto.contractStartDate);
    const end = dto.contractEndDate ? new Date(dto.contractEndDate) : null;
    const renewalReminderAt = dto.renewalReminderAt ? new Date(dto.renewalReminderAt) : end ? this.addDays(end, -30) : null;

    if (!payload.template?.templateFileUrl) {
      throw new BadRequestException('Selected template has no DOCX file');
    }
    const renderedDocxBuffer = await this.renderDocxTemplate(
      payload.template.templateFileUrl,
      payload.variables,
      { skipMissingSignatureImages: true },
    );

    const createdAtLabel = new Date().toISOString().slice(0, 10);
    const recipientSlug = String(payload.recipientFullName || 'recipient')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'recipient';
    const generatedPdfFileName = `${recipientSlug}-${createdAtLabel}-${randomUUID()}.pdf`;
    const generatedPdfBuffer = await this.convertDocxToPdf(renderedDocxBuffer.buffer, `${recipientSlug}.docx`);

    const generatedFileUrl = await this.storage.upload(
      generatedPdfBuffer,
      generatedPdfFileName,
      'application/pdf',
      'teacher-contracts-generated',
      actor.tenantSlug ?? 'shared',
      generatedPdfFileName,
    );

    const tpl = payload.template as { category?: any; recipientType?: string | null; approverRolesJson?: unknown } | null;
    const category = (dto.category ?? tpl?.category ?? null) as DocumentCategory | null;
    if (category && !isCategoryEnabled(category)) {
      throw new BadRequestException(`Document category "${category}" is not available yet`);
    }
    // Recipient + approvers: explicit dto wins, else the template's config, else the category default.
    const recipientType =
      this.normalizeRecipientType(dto.recipientType)
      ?? this.normalizeRecipientType(tpl?.recipientType ?? undefined)
      ?? (category ? getCategoryConfig(category).recipientType : null);
    const approverRoles =
      this.parseApproverRoles(dto.approverRoles)
      ?? (Array.isArray(tpl?.approverRolesJson) ? (tpl!.approverRolesJson as string[]) : undefined)
      ?? (category ? [getCategoryConfig(category).approverRole] : null);

    const created = await this.tenantPrisma.client.teacherContract.create({
      data: {
        teacherProfileId: payload.teacherProfileId,
        recipientUserId: payload.recipientUserId,
        templateId: payload.template?.id,
        category: category as any,
        recipientType,
        approverRolesJson: (approverRoles ?? undefined) as any,
        payloadJson: (dto.payload ?? undefined) as any,
        status: (dto.status ?? TeacherContractStatus.draft) as any,
        contractStartDate: start,
        contractEndDate: end,
        employmentStatus: (dto.employmentStatus ?? undefined) as EmploymentStatusLike | undefined,
        teachingAssignmentNotes: dto.teachingAssignmentNotes ?? null,
        documentTitle: generatedPdfFileName,
        fileUrl: generatedFileUrl,
        fileName: generatedPdfFileName,
        mimeType: 'application/pdf',
        sizeBytes: generatedPdfBuffer.length,
        signedAt: null,
        eSignature: dto.eSignature ?? null,
        notes: dto.notes,
        renderedContent: payload.renderedContent,
        renewalReminderAt,
        createdByUserId: actor.userId,
        updatedByUserId: actor.userId,
      },
      include: {
        teacher: { include: { user: true } },
        recipientUser: true,
        template: true,
      },
    });
    return created;
  }

  async createByUpload(dto: CreateUploadedTeacherContractDto, file: Express.Multer.File, actor: ActorContext) {
    this.assertCanCreate(actor);
    const recipient = await this.resolveRecipient(dto);

    const employmentStatus = dto.employmentStatus ?? recipient.teacher?.employmentStatus ?? undefined;
    const start = new Date(dto.contractStartDate);
    const end = dto.contractEndDate ? new Date(dto.contractEndDate) : null;
    const renewalReminderAt = dto.renewalReminderAt ? new Date(dto.renewalReminderAt) : end ? this.addDays(end, -30) : null;
    const createdAtLabel = new Date().toISOString().slice(0, 10);
    const recipientSlug = String(recipient.fullName ?? 'recipient')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'recipient';
    const finalFileName = file.originalname || `${recipientSlug}-${createdAtLabel}-${randomUUID()}`;

    const category = (dto.category ?? null) as DocumentCategory | null;
    if (category && !isCategoryEnabled(category)) {
      throw new BadRequestException(`Document category "${category}" is not available yet`);
    }
    const recipientType =
      this.normalizeRecipientType(dto.recipientType)
      ?? (category ? getCategoryConfig(category).recipientType : recipient.recipientType);
    const storageFileUrl = await this.storage.upload(
      file.buffer,
      finalFileName,
      file.mimetype,
      'teacher-contracts-uploaded',
      actor.tenantSlug ?? 'shared',
      finalFileName,
    );

    return this.tenantPrisma.client.teacherContract.create({
      data: {
        teacherProfileId: recipient.teacherProfileId,
        recipientUserId: recipient.recipientUserId,
        templateId: null,
        category: category as any,
        recipientType,
        status: TeacherContractStatus.draft as any,
        contractStartDate: start,
        contractEndDate: end,
        employmentStatus: employmentStatus as EmploymentStatusLike,
        documentTitle: dto.documentTitle ?? finalFileName,
        fileUrl: storageFileUrl,
        fileName: finalFileName,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        signedAt: dto.signedAt ? new Date(dto.signedAt) : null,
        eSignature: dto.eSignature ?? null,
        notes: dto.notes,
        renewalReminderAt,
        createdByUserId: actor.userId,
        updatedByUserId: actor.userId,
      },
      include: {
        teacher: { include: { user: true } },
        recipientUser: true,
        template: true,
      },
    });
  }

  findAll(filters: {
    teacherProfileId?: string;
    recipientUserId?: string;
    status?: TeacherContractStatus;
    category?: DocumentCategory;
    periodStart?: string;
    periodEnd?: string;
  }) {
    return this.tenantPrisma.client.teacherContract.findMany({
      where: {
        deletedAt: null,
        ...(filters.teacherProfileId ? { teacherProfileId: filters.teacherProfileId } : {}),
        ...(filters.recipientUserId ? { recipientUserId: filters.recipientUserId } : {}),
        ...(filters.status ? { status: filters.status as any } : {}),
        ...(filters.category ? { category: filters.category as any } : {}),
        ...(filters.periodStart || filters.periodEnd
          ? {
              contractStartDate: {
                ...(filters.periodStart ? { gte: new Date(filters.periodStart) } : {}),
                ...(filters.periodEnd ? { lte: new Date(filters.periodEnd) } : {}),
              },
            }
          : {}),
      },
      include: {
        teacher: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        recipientUser: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        template: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const data = await this.tenantPrisma.client.teacherContract.findFirst({
      where: { id, deletedAt: null },
      include: {
        teacher: { include: { user: true } },
        recipientUser: true,
        template: true,
      },
    });
    if (!data) throw new NotFoundException(`Teacher contract ${id} not found`);
    return data;
  }

  update(id: string, dto: UpdateTeacherContractDto, actor: ActorContext) {
    return this.tenantPrisma.client.teacherContract.update({
      where: { id },
      data: {
        ...(dto.contractStartDate ? { contractStartDate: new Date(dto.contractStartDate) } : {}),
        ...(dto.contractEndDate ? { contractEndDate: new Date(dto.contractEndDate) } : {}),
        ...(dto.employmentStatus ? { employmentStatus: dto.employmentStatus as any } : {}),
        ...(dto.teachingAssignmentNotes !== undefined ? { teachingAssignmentNotes: dto.teachingAssignmentNotes } : {}),
        ...(dto.signedAt ? { signedAt: new Date(dto.signedAt) } : {}),
        ...(dto.eSignature !== undefined ? { eSignature: dto.eSignature } : {}),
        ...(dto.documentTitle !== undefined ? { documentTitle: dto.documentTitle } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        updatedByUserId: actor.userId,
      },
    });
  }

  /** Submit a draft document to its configured approver (draft → pending_approval). */
  async submit(id: string, actor: ActorContext) {
    const contract = await this.findOne(id);
    if (contract.status !== 'draft' && contract.status !== 'rejected') {
      throw new ConflictException('Only draft or rejected documents can be submitted');
    }
    const updated = await this.tenantPrisma.client.teacherContract.update({
      where: { id },
      data: {
        status: TeacherContractStatus.pending_approval as any,
        rejectedAt: null,
        rejectReason: null,
        updatedByUserId: actor.userId,
      },
    });
    await this.notifyApprovers(contract);
    return updated;
  }

  /** Notify the configured approver role that a document awaits their approval & signature. */
  private async notifyApprovers(contract: {
    id: string;
    category: DocumentCategory | string | null;
    documentTitle?: string | null;
    teacher?: { user?: { fullName?: string | null } | null } | null;
    recipientUser?: { fullName?: string | null } | null;
  }) {
    try {
      const tenantSlug = getTenantContext()?.tenantSlug;
      if (!tenantSlug) return;
      const category = (contract.category ?? null) as DocumentCategory | null;
      const approverRole = category ? getCategoryConfig(category).approverRole : UserRole.principal;
      const label = category ? getCategoryConfig(category).label : 'Document';

      const approvers = await this.tenantPrisma.client.user.findMany({
        where: { role: approverRole as any, status: 'active' as any, deletedAt: null },
        select: { id: true },
      });
      if (approvers.length === 0) return;

      const teacherName = contract.teacher?.user?.fullName ?? contract.recipientUser?.fullName ?? 'a staff member';
      const title = `${label} awaiting approval`;
      const body = `${label} for ${teacherName} has been submitted and needs your approval & signature.`;

      await this.notifications.createManyAndQueue(
        approvers.map((a) => ({
          tenantSlug,
          userId: a.id,
          title,
          body,
          category: NotificationCategory.document,
          eventType: 'document_submitted',
          priority: NotificationPriority.high,
          sourceType: NotificationSourceType.contract,
          sourceId: contract.id,
          data: { pageId: 'principal-contracts' },
        })),
      );
    } catch {
      // Notifications are best-effort; never block the submission.
    }
  }

  /** Back-compat alias used by the admin UI. */
  publish(id: string, actor: ActorContext) {
    return this.submit(id, actor);
  }

  /** Reject a submitted document (pending_approval → rejected). */
  async reject(id: string, reason: string, actor: ActorContext) {
    const contract = await this.findOne(id);
    await this.assertCanApprove(contract, actor);
    if (contract.status !== 'pending_approval' && contract.status !== 'pending_signature') {
      throw new ConflictException('Only submitted documents can be rejected');
    }
    return this.tenantPrisma.client.teacherContract.update({
      where: { id },
      data: {
        status: TeacherContractStatus.rejected as any,
        rejectedAt: new Date(),
        rejectReason: reason ?? null,
        approverUserId: actor.userId,
        updatedByUserId: actor.userId,
      },
    });
  }

  async approve(id: string, eSignature: string, actor: ActorContext) {
    const contract = await this.findOne(id);
    // Allowed to approve & sign: the document's configured approver roles (or category/principal default).
    await this.assertCanApprove(contract, actor);
    const signable: string[] = ['pending_signature', 'pending_approval', 'approved'];
    if (!signable.includes(contract.status)) {
      throw new ConflictException('Only submitted documents can be approved & signed');
    }
    let signedFilePatch:
      | {
          fileUrl: string;
          fileName: string;
          mimeType: string;
          sizeBytes: number;
          renderedContent: string;
        }
      | undefined;

    if (contract.template?.templateFileUrl) {
      const templateKeys = ((contract.template.variablesJson as string[] | null) ?? [])
        .filter((key) => typeof key === 'string');
      const signatureTagInfo = await this.inspectSignatureTags(contract.template.templateFileUrl);
      if (signatureTagInfo.hasTextTag && !signatureTagInfo.hasImageTag) {
        throw new BadRequestException(
          'Template signature tag must be image tag {%e_signature} or {%eSignature}, not text tag {e_signature}/{eSignature}',
        );
      }
      const supportsSignatureVariable =
        templateKeys.includes('e_signature') ||
        templateKeys.includes('eSignature') ||
        signatureTagInfo.hasAnyTag;

      if (supportsSignatureVariable) {
        const signatureBuffer = this.base64ToImageBuffer(eSignature);
        if (!this.isLikelyImageBuffer(signatureBuffer)) {
          throw new BadRequestException(
            'Invalid eSignature image payload. Expected a valid base64-encoded image data URL.',
          );
        }
        const parsedVariables = this.parseRenderedVariables(contract.renderedContent);
        const signatureVariables = {
          ...parsedVariables,
          e_signature: eSignature,
          eSignature,
        };
        const renderedDocxBuffer = await this.renderDocxTemplate(
          contract.template.templateFileUrl,
          signatureVariables,
        );
        const signedPdfBuffer = await this.convertDocxToPdf(
          renderedDocxBuffer.buffer,
          `signed-${contract.fileName.replace(/\.pdf$/i, '')}.docx`,
        );
        const signedPdfFileName = `${contract.fileName.replace(/\.pdf$/i, '')}-signed.pdf`;
        const signedPdfUrl = await this.storage.upload(
          signedPdfBuffer,
          signedPdfFileName,
          'application/pdf',
          'teacher-contracts-generated',
          actor.tenantSlug ?? 'shared',
          signedPdfFileName,
        );

        signedFilePatch = {
          fileUrl: signedPdfUrl,
          fileName: signedPdfFileName,
          mimeType: 'application/pdf',
          sizeBytes: signedPdfBuffer.length,
          renderedContent: this.serializeRenderedVariables(signatureVariables),
        };
      }
    }

    const now = new Date();
    const signed = await this.tenantPrisma.client.teacherContract.update({
      where: { id },
      data: {
        status: TeacherContractStatus.active as any,
        eSignature,
        approverUserId: contract.approverUserId ?? actor.userId,
        approvedAt: contract.approvedAt ?? now,
        signerUserId: actor.userId,
        signedAt: now,
        ...(signedFilePatch ?? {}),
        updatedByUserId: actor.userId,
      },
    });

    // Apply the category's side-effect (teaching assignment, homeroom, …) on sign.
    await this.applySideEffect(contract.category as DocumentCategory | null, contract.teacherProfileId ?? null, contract.payloadJson);

    await this.notifyRecipientSigned(contract);

    return signed;
  }

  /** Notify the recipient that their document has been signed and is available to view/download. */
  private async notifyRecipientSigned(contract: {
    id: string;
    category: DocumentCategory | string | null;
    teacher?: { user?: { id?: string | null } | null } | null;
    recipientUser?: { id?: string | null } | null;
  }) {
    try {
      const tenantSlug = getTenantContext()?.tenantSlug;
      const recipientUserId = contract.recipientUser?.id ?? contract.teacher?.user?.id;
      if (!tenantSlug || !recipientUserId) return;
      const category = (contract.category ?? null) as DocumentCategory | null;
      const label = category ? getCategoryConfig(category).label : 'Document';
      await this.notifications.createAndQueue({
        tenantSlug,
        userId: recipientUserId,
        title: `${label} signed`,
        body: `Your ${label} has been approved & signed and is now available to view or download.`,
        category: NotificationCategory.document,
        eventType: 'document_signed',
        priority: NotificationPriority.normal,
        sourceType: NotificationSourceType.contract,
        sourceId: contract.id,
        data: { pageId: 'teacher-contracts' },
      });
    } catch {
      // Best-effort.
    }
  }

  /** Gate an action to the role configured for the document's category. */
  /** Only HR (school_admin) and Yayasan (network_admin) may draft documents & manage templates. */
  private assertCanCreate(actor: ActorContext) {
    if (actor.isSuperAdmin) return;
    const allowed: string[] = [UserRole.school_admin, UserRole.network_admin];
    if (!allowed.includes(actor.role ?? '')) {
      throw new ForbiddenException('Only Admin HR (school admin) or Yayasan may create documents and templates');
    }
  }

  /** The roles allowed to approve/reject/sign a document: its own approverRoles, else the category default, else principal. */
  private approverRolesFor(contract: { category?: unknown; approverRolesJson?: unknown }): string[] {
    if (Array.isArray(contract.approverRolesJson) && contract.approverRolesJson.length > 0) {
      return contract.approverRolesJson as string[];
    }
    const category = (contract.category ?? null) as DocumentCategory | null;
    return category ? [getCategoryConfig(category).approverRole] : [UserRole.principal];
  }

  private async assertCanApprove(contract: { category?: unknown; approverRolesJson?: unknown }, actor: ActorContext) {
    if (actor.isSuperAdmin) return;
    const roles = this.approverRolesFor(contract);
    if (roles.includes(actor.role ?? '')) return;
    // Delegate: a user granted the contract-approver flag may act for the principal.
    if (roles.includes(UserRole.principal)) {
      const user = await this.tenantPrisma.client.user.findFirst({
        where: { id: actor.userId, deletedAt: null },
        select: { contractApprover: true },
      });
      if (user?.contractApprover) return;
    }
    throw new ForbiddenException(`Only ${roles.join(' or ')} may approve/reject/sign this document`);
  }

  /** Apply a category's side-effect when a document is signed. Best-effort; never blocks signing. */
  private async applySideEffect(category: DocumentCategory | null, teacherProfileId: string | null, payload: unknown) {
    if (!category || !teacherProfileId) return;
    const { sideEffect } = getCategoryConfig(category);
    const data = (payload && typeof payload === 'object') ? payload as Record<string, any> : {};
    try {
      if (sideEffect === 'teaching_assignment') {
        const assignments: Array<{ subjectId?: string; classroomId?: string }> = Array.isArray(data.assignments) ? data.assignments : [];
        for (const a of assignments) {
          if (!a.subjectId || !a.classroomId) continue;
          await this.tenantPrisma.client.classSubject.upsert({
            where: { classroomId_subjectId: { classroomId: a.classroomId, subjectId: a.subjectId } },
            update: { teacherProfileId },
            create: { classroomId: a.classroomId, subjectId: a.subjectId, teacherProfileId },
          });
        }
      } else if (sideEffect === 'homeroom') {
        const classroomId: string | undefined = data.classroomId;
        const academicYear: string = String(data.academicYear ?? '');
        const semester = Number(data.semester ?? 1);
        if (classroomId && academicYear) {
          await this.tenantPrisma.client.homeroomAssignment.updateMany({
            where: { classroomId, academicYear, semester, isActive: true, deletedAt: null },
            data: { isActive: false, endedAt: new Date() },
          });
          await this.tenantPrisma.client.homeroomAssignment.create({
            data: { classroomId, teacherProfileId, academicYear, semester, isActive: true },
          });
          const teacher = await this.tenantPrisma.client.teacherProfile.findFirst({ where: { id: teacherProfileId }, select: { userId: true } });
          if (teacher?.userId) {
            await this.tenantPrisma.client.classroom.update({ where: { id: classroomId }, data: { homeroomUserId: teacher.userId } });
          }
        }
      }
      // 'employment_status', 'position', 'transfer', 'none' → handled in later phases.
    } catch {
      // Side-effects are best-effort; the signed document stands regardless.
    }
  }

  async updateReminder(id: string, dto: UpdateTeacherContractReminderDto, actor: ActorContext) {
    await this.findOne(id);
    return this.tenantPrisma.client.teacherContract.update({
      where: { id },
      data: {
        renewalReminderAt: new Date(dto.renewalReminderAt),
        updatedByUserId: actor.userId,
      },
    });
  }

  async findMyContracts(actor: ActorContext) {
    const profile = await this.tenantPrisma.client.teacherProfile.findFirst({
      where: { userId: actor.userId, deletedAt: null },
      select: { id: true },
    });
    if (profile) return this.findAll({ teacherProfileId: profile.id });
    return this.tenantPrisma.client.teacherContract.findMany({
      where: { deletedAt: null, recipientUserId: actor.userId },
      include: {
        teacher: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        recipientUser: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        template: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Soft-delete a contract/document. */
  async remove(id: string, actor: ActorContext) {
    await this.findOne(id); // 404 if it doesn't exist
    return this.tenantPrisma.client.teacherContract.update({
      where: { id },
      data: { deletedAt: new Date(), updatedByUserId: actor.userId },
    });
  }

  /**
   * Returns the teacher's currently-valid teaching authorization (SK Mengajar):
   * a contract that has been approved by the school admin (status = active) and
   * whose period has not ended. Null when the teacher has none.
   */
  async findActiveTeachingAuthorization(teacherProfileId: string) {
    return this.tenantPrisma.client.teacherContract.findFirst({
      where: {
        teacherProfileId,
        deletedAt: null,
        status: TeacherContractStatus.active as any,
        contractEndDate: { gte: new Date() },
      },
      orderBy: { contractEndDate: 'desc' },
      select: { id: true, contractEndDate: true },
    });
  }

  findRenewalReminders(days = 30) {
    const now = new Date();
    const until = this.addDays(now, days);
    return this.tenantPrisma.client.teacherContract.findMany({
      where: {
        deletedAt: null,
        status: { in: [TeacherContractStatus.active as any, TeacherContractStatus.draft as any] },
        contractEndDate: { gte: now, lte: until },
      },
      include: {
        teacher: { include: { user: { select: { fullName: true, email: true } } } },
        recipientUser: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      },
      orderBy: { contractEndDate: 'asc' },
    });
  }

  private async buildRenderedContract(dto: PreviewTeacherContractDto | CreateTeacherContractDto) {
    const template = 'templateId' in dto && dto.templateId
      ? await this.tenantPrisma.client.teacherContractTemplate.findFirst({ where: { id: dto.templateId, deletedAt: null, isActive: true } })
      : null;
    if (!template) throw new BadRequestException('templateId is required and must reference an active template');

    const category = (dto.category ?? template.category ?? null) as DocumentCategory | null;
    const recipientType =
      this.normalizeRecipientType(dto.recipientType)
      ?? this.normalizeRecipientType(template.recipientType)
      ?? (category ? getCategoryConfig(category).recipientType : undefined);
    const recipient = await this.resolveRecipient({
      teacherProfileId: dto.teacherProfileId,
      recipientUserId: dto.recipientUserId,
      recipientType,
    });

    const customVariables = ('variables' in dto && dto.variables) ? dto.variables : {};
    const recipientMap = recipient.teacher
      ? this.buildTeacherVariableMap(recipient.teacher, dto)
      : this.buildUserVariableMap(recipient.user, dto);
    const templateVariableKeys = ((template.variablesJson as string[] | null) ?? [])
      .filter((key) => typeof key === 'string');
    const variables = templateVariableKeys.reduce<Record<string, string | number>>((acc, key) => {
      // Admin-supplied value wins; otherwise auto-fill from the teacher's profile.
      const custom = customVariables[key];
      const value = (custom !== undefined && custom !== '')
        ? custom
        : recipientMap[this.normalizeVarKey(key)];
      if (value !== undefined && value !== '') acc[key] = value;
      return acc;
    }, {});

    const renderedContent = this.serializeRenderedVariables(variables);
    return {
      template,
      variables,
      renderedContent,
      recipientFullName: recipient.fullName,
      teacherProfileId: recipient.teacherProfileId,
      recipientUserId: recipient.recipientUserId,
    };
  }

  private async resolveRecipient(input: { teacherProfileId?: string; recipientUserId?: string; recipientType?: string }) {
    if (input.teacherProfileId) {
      const teacher = await this.tenantPrisma.client.teacherProfile.findFirst({
        where: { id: input.teacherProfileId, deletedAt: null },
        include: PROFILE_INCLUDE,
      });
      if (!teacher) throw new NotFoundException(`Teacher profile ${input.teacherProfileId} not found`);
      return {
        teacher,
        user: teacher.user,
        fullName: teacher.user?.fullName ?? '',
        teacherProfileId: teacher.id,
        recipientUserId: teacher.user?.id ?? null,
        recipientType: 'teacher',
      };
    }

    if (input.recipientUserId) {
      const user = await this.tenantPrisma.client.user.findFirst({
        where: { id: input.recipientUserId, deletedAt: null },
        select: { id: true, fullName: true, email: true, phone: true, role: true },
      });
      if (!user) throw new NotFoundException(`Recipient user ${input.recipientUserId} not found`);
      return {
        teacher: null,
        user,
        fullName: user.fullName,
        teacherProfileId: null,
        recipientUserId: user.id,
        recipientType: input.recipientType ?? (user.role === UserRole.principal ? 'principal' : 'staff'),
      };
    }

    throw new BadRequestException('teacherProfileId or recipientUserId is required');
  }

  /** Normalize a template placeholder key for alias matching: lowercase, alnum only. */
  private normalizeVarKey(key: string): string {
    return key.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private formatIndoDate(value: Date | string | null | undefined): string {
    if (!value) return '';
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '';
    return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
  }

  /**
   * Maps a teacher's profile data onto the placeholder keys an SK template might use,
   * indexed by normalized alias so e.g. {{nama_guru}}, {{namaGuru}} and {{nama}} all resolve.
   */
  private buildTeacherVariableMap(
    teacher: {
      user?: { fullName?: string | null; email?: string | null } | null;
      nik?: string | null;
      nuptk?: string | null;
      birthDate?: Date | string | null;
      birthPlace?: string | null;
      gender?: string | null;
      religion?: string | null;
      phone?: string | null;
      email?: string | null;
      employmentStatus?: string | null;
      classSubjects?: Array<{ subject?: { name?: string | null } | null; classroom?: { name?: string | null } | null }>;
    },
    dto: PreviewTeacherContractDto | CreateTeacherContractDto,
  ): Record<string, string> {
    const fullName = teacher.user?.fullName ?? '';
    const genderLabel =
      teacher.gender === 'male' ? 'Laki-laki' : teacher.gender === 'female' ? 'Perempuan' : '';
    const empLabels: Record<string, string> = { pns: 'PNS', p3k: 'P3K', tetap: 'Tetap', honorer: 'Honorer' };
    const employmentLabel = teacher.employmentStatus
      ? empLabels[teacher.employmentStatus] ?? String(teacher.employmentStatus)
      : '';
    const birthDateLabel = this.formatIndoDate(teacher.birthDate);
    const ttl = teacher.birthPlace && birthDateLabel
      ? `${teacher.birthPlace}, ${birthDateLabel}`
      : (teacher.birthPlace || birthDateLabel || '');
    const subjects = [...new Set((teacher.classSubjects ?? []).map((cs) => cs.subject?.name).filter(Boolean))] as string[];
    const classes = [...new Set((teacher.classSubjects ?? []).map((cs) => cs.classroom?.name).filter(Boolean))] as string[];
    const tugasMengajar = subjects.length ? subjects.join(', ') : '';
    const roleTitle = ('roleTitle' in dto && dto.roleTitle)
      ? dto.roleTitle
      : (subjects.length ? `Guru ${subjects[0]}` : '');

    const byAlias: Record<string, string> = {};
    const set = (aliases: string[], value: string) => {
      for (const alias of aliases) byAlias[this.normalizeVarKey(alias)] = value;
    };
    set(['nama', 'nama_guru', 'nama_lengkap', 'nama_lengkap_gelar', 'teacher_name', 'name'], fullName);
    set(['nik'], teacher.nik ?? '');
    set(['nuptk'], teacher.nuptk ?? '');
    set(['tempat_lahir', 'birth_place'], teacher.birthPlace ?? '');
    set(['tanggal_lahir', 'tgl_lahir', 'birth_date'], birthDateLabel);
    set(['tempat_tanggal_lahir', 'ttl', 'tempat_tgl_lahir'], ttl);
    set(['jenis_kelamin', 'gender', 'jk'], genderLabel);
    set(['agama', 'religion'], teacher.religion ?? '');
    set(['telepon', 'no_telepon', 'no_hp', 'phone', 'hp'], teacher.phone ?? '');
    set(['email'], teacher.email ?? teacher.user?.email ?? '');
    set(['status_kepegawaian', 'employment_status', 'status_pegawai'], employmentLabel);
    set(['tugas_mengajar', 'mata_pelajaran', 'mapel'], tugasMengajar);
    set(['kelas', 'kelas_mengajar'], classes.join(', '));
    set(['jabatan', 'role_title'], roleTitle);
    return byAlias;
  }

  private buildUserVariableMap(
    user: { fullName?: string | null; email?: string | null; phone?: string | null; role?: string | null } | null | undefined,
    dto: PreviewTeacherContractDto | CreateTeacherContractDto,
  ): Record<string, string> {
    const fullName = user?.fullName ?? '';
    const roleTitle = ('roleTitle' in dto && dto.roleTitle) ? dto.roleTitle : this.formatRoleLabel(user?.role);
    const byAlias: Record<string, string> = {};
    const set = (aliases: string[], value: string) => {
      for (const alias of aliases) byAlias[this.normalizeVarKey(alias)] = value;
    };
    set(['nama', 'nama_guru', 'nama_staff', 'nama_pegawai', 'nama_kepala_sekolah', 'nama_lengkap', 'teacher_name', 'name'], fullName);
    set(['email'], user?.email ?? '');
    set(['telepon', 'no_telepon', 'no_hp', 'phone', 'hp'], user?.phone ?? '');
    set(['jabatan', 'role_title', 'posisi'], roleTitle);
    return byAlias;
  }

  private formatRoleLabel(role: string | null | undefined): string {
    const labels: Record<string, string> = {
      principal: 'Kepala Sekolah',
      school_admin: 'Staff Admin',
      network_admin: 'Yayasan',
      teacher: 'Guru',
      finance: 'Finance',
      staff: 'Staff',
    };
    return role ? labels[role] ?? role : '';
  }

  private serializeRenderedVariables(variables: Record<string, string | number>) {
    return JSON.stringify(variables);
  }

  private parseRenderedVariables(raw: string | null | undefined): Record<string, string | number> {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const entries = Object.entries(parsed as Record<string, unknown>)
        .filter(([, value]) => typeof value === 'string' || typeof value === 'number');
      return entries.reduce<Record<string, string | number>>((acc, [key, value]) => {
        if (typeof value === 'string' || typeof value === 'number') acc[key] = value;
        return acc;
      }, {});
    } catch {
      return {};
    }
  }

  private async renderDocxTemplate(
    templateFileUrl: string,
    variables: Record<string, string | number>,
    options: { skipMissingSignatureImages?: boolean } = {},
  ) {
    const templateBuffer = await this.storage.read(templateFileUrl);
    const zip = new PizZip(templateBuffer);
    const { default: ImageModuleCtor } = await import('docxtemplater-image-module-free');
    const signatureWidth = Number(process.env.DOCX_SIGNATURE_WIDTH ?? 180);
    const signatureHeight = Number(process.env.DOCX_SIGNATURE_HEIGHT ?? 70);
    const imageModule = new ImageModuleCtor({
      centered: false,
      getImage: (tagValue: string, tagName: string) => {
        if (options.skipMissingSignatureImages && !tagValue && this.isSignatureImageTag(tagName)) {
          return TRANSPARENT_PNG;
        }
        const buffer = this.base64ToImageBuffer(tagValue);
        if (!this.isLikelyImageBuffer(buffer)) {
          throw new BadRequestException(
            `Invalid image payload for template tag ${tagName}. Expected a valid base64-encoded image.`,
          );
        }
        return buffer;
      },
      getSize: () => [signatureWidth, signatureHeight],
    });
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
      modules: [imageModule],
    });
    doc.render(variables);
    const output = doc.getZip().generate({ type: 'nodebuffer' });
    return {
      buffer: output,
      fileName: `generated-contract-${Date.now()}.docx`,
    };
  }

  private isSignatureImageTag(tagName: string): boolean {
    return /sign|ttd|tanda|paraf|signature/i.test(tagName);
  }

  private base64ToImageBuffer(value: string): Buffer {
    if (!value) return Buffer.alloc(0);
    const normalized = String(value).trim();
    const dataUrlMatch = normalized.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,([\s\S]+)$/i);
    const encoded = (dataUrlMatch ? dataUrlMatch[1] : normalized).replace(/\s+/g, '');
    try {
      const buffer = Buffer.from(encoded, 'base64');
      return buffer.length > 0 ? buffer : Buffer.alloc(0);
    } catch {
      return Buffer.alloc(0);
    }
  }

  private isLikelyImageBuffer(buffer: Buffer): boolean {
    if (!buffer.length) return false;
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return true;
    }
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return true;
    }
    if (buffer.length >= 6) {
      const header = buffer.subarray(0, 6).toString('ascii');
      if (header === 'GIF87a' || header === 'GIF89a') return true;
    }
    if (buffer.length >= 12) {
      const riff = buffer.subarray(0, 4).toString('ascii');
      const webp = buffer.subarray(8, 12).toString('ascii');
      if (riff === 'RIFF' && webp === 'WEBP') return true;
    }
    return false;
  }

  private getDocxXmlPlainText(xml: string): string {
    return xml.replace(/<[^>]+>/g, '');
  }

  private extractDocxVariableKeys(buffer: Buffer): string[] {
    const zip = new PizZip(buffer);
    const textEntries = Object.keys(zip.files)
      .filter((name) => name.startsWith('word/') && name.endsWith('.xml'));
    const pattern = /\{[%#/^@]?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}/g;
    const keys = new Set<string>();
    for (const entry of textEntries) {
      const text = this.getDocxXmlPlainText(zip.files[entry].asText());
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        keys.add(match[1]);
      }
    }
    return [...keys];
  }

  private async inspectSignatureTags(templateFileUrl: string): Promise<{
    hasAnyTag: boolean;
    hasImageTag: boolean;
    hasTextTag: boolean;
  }> {
    const templateBuffer = await this.storage.read(templateFileUrl);
    const zip = new PizZip(templateBuffer);
    const textEntries = Object.keys(zip.files)
      .filter((name) => name.startsWith('word/') && name.endsWith('.xml'));
    const imageTagPattern = /\{%\s*(e_signature|eSignature)\s*\}/;
    const textTagPattern = /\{\s*(e_signature|eSignature)\s*\}/;
    let hasImageTag = false;
    let hasTextTag = false;
    for (const entry of textEntries) {
      const text = this.getDocxXmlPlainText(zip.files[entry].asText());
      if (imageTagPattern.test(text)) hasImageTag = true;
      if (textTagPattern.test(text)) hasTextTag = true;
      if (hasImageTag && hasTextTag) break;
    }
    return {
      hasAnyTag: hasImageTag || hasTextTag,
      hasImageTag,
      hasTextTag,
    };
  }

  private getUnresolvedTemplateVariables(
    definitions: TemplateVariableMeta[],
    resolved: Record<string, string | number>,
  ) {
    return definitions
      .filter((def) => def.required)
      .map((def) => def.key)
      .filter((key) => resolved[key] === undefined || resolved[key] === null || resolved[key] === '');
  }

  private toVariableMetaList(keys: string[]): TemplateVariableMeta[] {
    return keys.map((key) => this.toVariableMeta(key));
  }

  private toVariableMeta(key: string): TemplateVariableMeta {
    return {
      key,
      label: key,
      source: 'custom',
      required: false,
    };
  }

  private async convertDocxToPdf(docxBuffer: Buffer, docxFileName: string) {
    const gotenbergUrl = process.env.GOTENBERG_URL ?? 'http://gotenberg:3000';
    const form = new FormData();
    form.append(
      'files',
      new Blob([new Uint8Array(docxBuffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
      docxFileName,
    );

    const response = await fetch(`${gotenbergUrl}/forms/libreoffice/convert`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) {
      throw new BadRequestException(`Failed to convert DOCX to PDF (status ${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}

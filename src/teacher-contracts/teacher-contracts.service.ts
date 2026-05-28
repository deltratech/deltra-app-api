import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
  TeacherContractTemplateType,
} from './dto/create-teacher-contract.dto';
import { CreateUploadedTeacherContractDto } from './dto/create-uploaded-teacher-contract.dto';
import { PreviewTeacherContractDto } from './dto/preview-teacher-contract.dto';
import { UpdateContractTemplateDto } from './dto/update-contract-template.dto';
import { UpdateTeacherContractReminderDto } from './dto/update-teacher-contract-reminder.dto';
import { UpdateTeacherContractDto } from './dto/update-teacher-contract.dto';

type ActorContext = { userId: string; tenantSlug?: string; isSuperAdmin?: boolean };
type EmploymentStatusLike = EmploymentStatus | `${EmploymentStatus}`;
type TemplateTypeLike = TeacherContractTemplateType | `${TeacherContractTemplateType}`;
type TemplateVariableMeta = {
  key: string;
  label: string;
  source: 'custom';
  required: boolean;
};

const PROFILE_INCLUDE = {
  user: { select: { id: true, fullName: true, email: true, phone: true } },
  classSubjects: {
    where: { classroom: { deletedAt: null }, subject: { deletedAt: null } },
    include: {
      subject: { select: { name: true } },
      classroom: { select: { name: true } },
    },
  },
  schedules: { where: { deletedAt: null }, select: { id: true } },
  requirements: { select: { sessionsPerWeek: true } },
} as const;

@Injectable()
export class TeacherContractsService {
  constructor(
    private readonly tenantPrisma: PrismaTenantService,
    private readonly storage: StorageService,
  ) {}

  async createTemplate(dto: CreateContractTemplateDto, file: Express.Multer.File) {
    const existing = await this.tenantPrisma.client.teacherContractTemplate.findFirst({
      where: {
        deletedAt: null,
        name: dto.name,
        templateType: dto.templateType as any,
        version: dto.version ?? 1,
      },
    });
    if (existing) throw new ConflictException('Template with same name, type, and version already exists');

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
        templateType: dto.templateType as any,
        variablesJson: extractedVariableKeys as any,
        templateFileUrl,
        templateFileName: file.originalname,
        templateMimeType: file.mimetype,
        templateSizeBytes: file.size,
        version: dto.version ?? 1,
        isActive: dto.isActive ?? true,
      } as any,
    });
  }

  findTemplates(filters: { templateType?: TeacherContractTemplateType; isActive?: boolean }) {
    return this.tenantPrisma.client.teacherContractTemplate.findMany({
      where: {
        deletedAt: null,
        ...(filters.templateType ? { templateType: filters.templateType as any } : {}),
        ...(typeof filters.isActive === 'boolean' ? { isActive: filters.isActive } : {}),
      },
      orderBy: [{ templateType: 'asc' }, { version: 'desc' }],
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

  async updateTemplate(id: string, dto: UpdateContractTemplateDto, file?: Express.Multer.File) {
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
        ...(dto.templateType ? { templateType: dto.templateType as any } : {}),
        ...(dto.version !== undefined ? { version: dto.version } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(file ? { variablesJson: this.extractDocxVariableKeys(file.buffer) as any } : {}),
        ...(filePatch ?? {}),
      },
    });
  }

  async removeTemplate(id: string) {
    const template = await this.findTemplateOne(id);
    if (template.templateFileUrl) await this.storage.delete(template.templateFileUrl);
    return this.tenantPrisma.client.teacherContractTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async preview(dto: PreviewTeacherContractDto) {
    const payload = await this.buildRenderedContract(dto);
    return { ...payload, mode: 'preview' };
  }

  async create(dto: CreateTeacherContractDto, actor: ActorContext) {
    if (!dto.templateId) {
      throw new BadRequestException('templateId is required to generate a contract from DOCX template');
    }
    const payload = await this.buildRenderedContract(dto);
    const start = new Date(dto.contractStartDate);
    const end = new Date(dto.contractEndDate);
    const renewalReminderAt = dto.renewalReminderAt ? new Date(dto.renewalReminderAt) : this.addDays(end, -30);

    if (!payload.template?.templateFileUrl) {
      throw new BadRequestException('Selected template has no DOCX file');
    }
    const renderedDocxBuffer = await this.renderDocxTemplate(
      payload.template.templateFileUrl,
      payload.variables,
    );

    const createdAtLabel = new Date().toISOString().slice(0, 10);
    const teacherSlug = String(payload.variables.teacherName ?? 'teacher')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'teacher';
    const generatedPdfFileName = `${teacherSlug}-${createdAtLabel}-${randomUUID()}.pdf`;
    const generatedPdfBuffer = await this.convertDocxToPdf(renderedDocxBuffer.buffer, `${teacherSlug}.docx`);

    const generatedFileUrl = await this.storage.upload(
      generatedPdfBuffer,
      generatedPdfFileName,
      'application/pdf',
      'teacher-contracts-generated',
      actor.tenantSlug ?? 'shared',
      generatedPdfFileName,
    );

    const created = await this.tenantPrisma.client.teacherContract.create({
      data: {
        teacherProfileId: dto.teacherProfileId,
        templateId: payload.template?.id,
        templateType: payload.templateType,
        status: (dto.status ?? TeacherContractStatus.draft) as any,
        contractStartDate: start,
        contractEndDate: end,
        employmentStatus: payload.variables.employmentStatus as EmploymentStatusLike,
        teachingAssignmentNotes: String(payload.variables.teachingAssignmentSummary),
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
        template: true,
      },
    });
    return created;
  }

  async createByUpload(dto: CreateUploadedTeacherContractDto, file: Express.Multer.File, actor: ActorContext) {
    const teacher = await this.tenantPrisma.client.teacherProfile.findFirst({
      where: { id: dto.teacherProfileId, deletedAt: null },
      include: { user: { select: { fullName: true } } },
    });
    if (!teacher) throw new NotFoundException(`Teacher profile ${dto.teacherProfileId} not found`);

    const employmentStatus = dto.employmentStatus ?? teacher.employmentStatus ?? undefined;
    const templateType = dto.templateType ?? this.resolveTemplateType(employmentStatus);
    const start = new Date(dto.contractStartDate);
    const end = new Date(dto.contractEndDate);
    const renewalReminderAt = dto.renewalReminderAt ? new Date(dto.renewalReminderAt) : this.addDays(end, -30);
    const createdAtLabel = new Date().toISOString().slice(0, 10);
    const teacherSlug = String(teacher.user.fullName ?? 'teacher')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'teacher';
    const finalFileName = file.originalname || `${teacherSlug}-${createdAtLabel}-${randomUUID()}`;
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
        teacherProfileId: dto.teacherProfileId,
        templateId: null,
        templateType: templateType as any,
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
        template: true,
      },
    });
  }

  findAll(filters: {
    teacherProfileId?: string;
    templateType?: TeacherContractTemplateType;
    status?: TeacherContractStatus;
    periodStart?: string;
    periodEnd?: string;
  }) {
    return this.tenantPrisma.client.teacherContract.findMany({
      where: {
        deletedAt: null,
        ...(filters.teacherProfileId ? { teacherProfileId: filters.teacherProfileId } : {}),
        ...(filters.templateType ? { templateType: filters.templateType as any } : {}),
        ...(filters.status ? { status: filters.status as any } : {}),
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
        ...(dto.templateType ? { templateType: dto.templateType as any } : {}),
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

  async publish(id: string, actor: ActorContext) {
    const contract = await this.findOne(id);
    if (contract.status !== 'draft') {
      throw new ConflictException('Only draft contracts can be published');
    }
    return this.tenantPrisma.client.teacherContract.update({
      where: { id },
      data: {
        status: TeacherContractStatus.pending_signature as any,
        updatedByUserId: actor.userId,
      },
    });
  }

  async approve(id: string, eSignature: string, actor: ActorContext) {
    const contract = await this.findOne(id);
    if (contract.status !== 'pending_signature') {
      throw new ConflictException('Only pending signature contracts can be approved');
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

    return this.tenantPrisma.client.teacherContract.update({
      where: { id },
      data: {
        status: TeacherContractStatus.active as any,
        eSignature,
        signedAt: new Date(),
        ...(signedFilePatch ?? {}),
        updatedByUserId: actor.userId,
      },
    });
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
    if (!profile) throw new NotFoundException('Teacher profile for current user not found');
    return this.findAll({ teacherProfileId: profile.id });
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
      include: { teacher: { include: { user: { select: { fullName: true, email: true } } } } },
      orderBy: { contractEndDate: 'asc' },
    });
  }

  private async buildRenderedContract(dto: PreviewTeacherContractDto | CreateTeacherContractDto) {
    const teacher = await this.tenantPrisma.client.teacherProfile.findFirst({
      where: { id: dto.teacherProfileId, deletedAt: null },
      include: PROFILE_INCLUDE,
    });
    if (!teacher) throw new NotFoundException(`Teacher profile ${dto.teacherProfileId} not found`);

    const template = 'templateId' in dto && dto.templateId
      ? await this.tenantPrisma.client.teacherContractTemplate.findFirst({ where: { id: dto.templateId, deletedAt: null, isActive: true } })
      : null;
    if (!template) throw new BadRequestException('templateId is required and must reference an active template');
    const employmentStatus = dto.employmentStatus ?? teacher.employmentStatus ?? undefined;
    const templateType = ('templateType' in dto && dto.templateType)
      ? dto.templateType
      : template?.templateType ?? this.resolveTemplateType(employmentStatus);

    const customVariables = ('variables' in dto && dto.variables) ? dto.variables : {};
    const templateVariableKeys = ((template.variablesJson as string[] | null) ?? [])
      .filter((key) => typeof key === 'string');
    const variables = templateVariableKeys.reduce<Record<string, string | number>>((acc, key) => {
      if (customVariables[key] !== undefined) acc[key] = customVariables[key];
      return acc;
    }, {});

    const renderedContent = this.serializeRenderedVariables(variables);
    return { templateType, template, variables, renderedContent };
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
  ) {
    const templateBuffer = await this.storage.read(templateFileUrl);
    const zip = new PizZip(templateBuffer);
    const { default: ImageModuleCtor } = await import('docxtemplater-image-module-free');
    const signatureWidth = Number(process.env.DOCX_SIGNATURE_WIDTH ?? 180);
    const signatureHeight = Number(process.env.DOCX_SIGNATURE_HEIGHT ?? 70);
    const imageModule = new ImageModuleCtor({
      centered: false,
      getImage: (tagValue: string, tagName: string) => {
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

  private resolveTemplateType(status: EmploymentStatusLike | undefined) {
    if (status === EmploymentStatus.honorer) return TeacherContractTemplateType.guru_honorer;
    return TeacherContractTemplateType.guru_tetap;
  }

  private resolveRoleTitle(type: TemplateTypeLike, subjects: string[]) {
    if (type === TeacherContractTemplateType.staff) return 'Staff Sekolah';
    return subjects.length > 0 ? `Guru ${subjects[0]}` : 'Guru';
  }

  private resolveTeachingHours(
    teacher: {
      schedules: Array<{ id: string }>;
      requirements: Array<{ sessionsPerWeek: number }>;
      classSubjects: Array<{ id: string }>;
    },
    explicit?: number,
  ) {
    if (typeof explicit === 'number') return explicit;
    if (teacher.schedules.length > 0) return teacher.schedules.length;
    const requirementHours = teacher.requirements.reduce((sum, it) => sum + it.sessionsPerWeek, 0);
    if (requirementHours > 0) return requirementHours;
    return teacher.classSubjects.length;
  }

  private buildTeachingAssignmentSummary(subjectNames: string[], classNames: string[]) {
    const subjectLabel = subjectNames.length ? subjectNames.join(', ') : 'mata pelajaran sesuai penugasan';
    const classLabel = classNames.length ? classNames.join(', ') : 'kelas sesuai penugasan';
    return `${subjectLabel} pada ${classLabel}`;
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}

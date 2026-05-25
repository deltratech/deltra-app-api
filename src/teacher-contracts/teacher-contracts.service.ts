import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { StorageService } from '../storage/storage.service';
import { EmploymentStatus } from '../common/enums/employment-status.enum';
import { CreateContractTemplateDto } from './dto/create-contract-template.dto';
import {
  CreateTeacherContractDto,
  TeacherContractStatus,
  TeacherContractTemplateType,
} from './dto/create-teacher-contract.dto';
import { PreviewTeacherContractDto } from './dto/preview-teacher-contract.dto';
import { UpdateContractTemplateDto } from './dto/update-contract-template.dto';
import { UpdateTeacherContractDto } from './dto/update-teacher-contract.dto';

type ActorContext = { userId: string; tenantSlug?: string; isSuperAdmin?: boolean };
type EmploymentStatusLike = EmploymentStatus | `${EmploymentStatus}`;
type TemplateTypeLike = TeacherContractTemplateType | `${TeacherContractTemplateType}`;

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
    const existing = await this.tenantPrisma.client.teacherContractTemplate.findUnique({
      where: { code: dto.code },
    });
    if (existing) throw new ConflictException(`Template code '${dto.code}' already exists`);

    const templateFileUrl = await this.storage.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      'teacher-contract-templates',
      'shared',
    );

    return this.tenantPrisma.client.teacherContractTemplate.create({
      data: {
        code: dto.code,
        name: dto.name,
        templateType: dto.templateType as any,
        body: dto.body ?? null,
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
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.version !== undefined ? { version: dto.version } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(filePatch ?? {}),
      },
    });
  }

  async preview(dto: PreviewTeacherContractDto) {
    const payload = await this.buildRenderedContract(dto);
    return { ...payload, mode: 'preview' };
  }

  async create(dto: CreateTeacherContractDto, actor: ActorContext) {
    const payload = await this.buildRenderedContract(dto);
    const start = new Date(dto.contractStartDate);
    const end = new Date(dto.contractEndDate);
    const renewalReminderAt = this.addDays(end, -30);

    const created = await this.tenantPrisma.client.teacherContract.create({
      data: {
        teacherProfileId: dto.teacherProfileId,
        templateId: payload.template?.id,
        templateType: payload.templateType,
        status: TeacherContractStatus.draft as any,
        contractStartDate: start,
        contractEndDate: end,
        roleTitle: String(payload.variables.roleTitle),
        employmentStatus: payload.variables.employmentStatus as EmploymentStatusLike,
        teachingHoursPerWeek: Number(payload.variables.teachingHoursPerWeek),
        teachingAssignmentNotes: String(payload.variables.teachingAssignmentSummary),
        documentTitle: `Kontrak ${payload.variables.teacherName}`,
        fileUrl: '',
        fileName: '',
        mimeType: '',
        sizeBytes: 0,
        placeOfSigning: 'Sekolah',
        schoolRepresentativeName: 'Pimpinan Sekolah',
        schoolRepresentativeTitle: 'Kepala Sekolah',
        notes: dto.notes,
        variablesJson: payload.variables as any,
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
        ...(dto.roleTitle !== undefined ? { roleTitle: dto.roleTitle } : {}),
        ...(dto.employmentStatus ? { employmentStatus: dto.employmentStatus as any } : {}),
        ...(dto.teachingHoursPerWeek !== undefined ? { teachingHoursPerWeek: dto.teachingHoursPerWeek } : {}),
        ...(dto.teachingAssignmentNotes !== undefined ? { teachingAssignmentNotes: dto.teachingAssignmentNotes } : {}),
        ...(dto.documentTitle !== undefined ? { documentTitle: dto.documentTitle } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        updatedByUserId: actor.userId,
      },
    });
  }

  setPdfUrl(id: string, pdfUrl: string, actor: ActorContext) {
    return this.tenantPrisma.client.teacherContract.update({
      where: { id },
      data: {
        pdfUrl,
        updatedByUserId: actor.userId,
      },
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
    const employmentStatus = dto.employmentStatus ?? teacher.employmentStatus ?? undefined;
    const templateType = ('templateType' in dto && dto.templateType)
      ? dto.templateType
      : template?.templateType ?? this.resolveTemplateType(employmentStatus);

    const roleTitle = dto.roleTitle ?? this.resolveRoleTitle(templateType, teacher.classSubjects.map(s => s.subject.name));
    const teachingHours = this.resolveTeachingHours(teacher, 'teachingHoursPerWeek' in dto ? dto.teachingHoursPerWeek : undefined);
    const variables = {
      teacherName: teacher.user.fullName,
      employmentStatus: employmentStatus ?? '-',
      roleTitle,
      teachingHoursPerWeek: teachingHours,
      teachingTimeLabel: `${teachingHours} jam per minggu`,
      teachingAssignmentSummary: this.buildTeachingAssignmentSummary(
        [...new Set(teacher.classSubjects.map((i) => i.subject.name))],
        [...new Set(teacher.classSubjects.map((i) => i.classroom.name))],
      ),
      contractStartDate: dto.contractStartDate,
      contractEndDate: dto.contractEndDate,
      contractPeriod: `${dto.contractStartDate} s.d. ${dto.contractEndDate}`,
      ...(('variables' in dto && dto.variables) ? dto.variables : {}),
    };

    const body = template?.body ?? this.defaultTemplateBody(templateType);
    const renderedContent = this.renderTemplate(body, variables);
    return { templateType, template, variables, renderedContent };
  }

  private defaultTemplateBody(type: TemplateTypeLike) {
    if (type === TeacherContractTemplateType.staff) {
      return 'Kontrak kerja staff untuk {teacherName} sebagai {roleTitle} selama {contractPeriod}.';
    }
    return 'Kontrak kerja guru untuk {teacherName} sebagai {roleTitle} dengan beban {teachingTimeLabel} selama {contractPeriod}.';
  }

  private renderTemplate(template: string, variables: Record<string, string | number>) {
    let rendered = template;
    Object.entries(variables).forEach(([k, v]) => {
      rendered = rendered.replaceAll(`{${k}}`, String(v));
    });
    return rendered;
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

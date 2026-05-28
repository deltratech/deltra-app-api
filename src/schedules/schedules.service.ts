import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CreateScheduleEntryDto } from './dto/create-schedule-entry.dto';
import { UpdateScheduleEntryDto } from './dto/update-schedule-entry.dto';
import { CreatePeriodTemplateDto } from './dto/create-period-template.dto';
import { UpdatePeriodTemplateDto } from './dto/update-period-template.dto';
import { CreatePeriodRowDto } from './dto/create-period-row.dto';
import { UpdatePeriodRowDto } from './dto/update-period-row.dto';
import { ScheduleStatus } from '../common/enums/schedule-status.enum';
import { paginatedResult } from '../common/utils/paginate';

const ENTRY_INCLUDE = {
  subject: { select: { id: true, code: true, name: true } },
  teacher: { select: { id: true, nuptk: true, user: { select: { id: true, fullName: true } } } },
  room: { select: { id: true, name: true, capacity: true } },
  periodRow: true,
};

const SCHEDULE_INCLUDE = {
  classroom: { select: { id: true, name: true, gradeLevel: true, academicYear: true, semester: true } },
  entries: {
    where: { deletedAt: null },
    include: ENTRY_INCLUDE,
    orderBy: [{ dayOfWeek: 'asc' as const }, { periodRow: { sortOrder: 'asc' as const } }],
  },
};

@Injectable()
export class SchedulesService {
  constructor(private readonly tenantPrisma: PrismaTenantService) {}

  async findAll(filters: {
    classroomId?: string;
    academicYear?: string;
    semester?: number;
    status?: ScheduleStatus;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const { classroomId, academicYear, semester, status, page = 1, limit = 20, search } = filters;
    const skip = (page - 1) * limit;
    const where = {
      deletedAt: null,
      ...(classroomId ? { classroomId } : {}),
      ...(academicYear ? { academicYear } : {}),
      ...(semester ? { semester } : {}),
      ...(status ? { status } : {}),
      ...(search ? { classroom: { name: { contains: search, mode: 'insensitive' as const } } } : {}),
    };

    const [data, total] = await Promise.all([
      this.tenantPrisma.client.schedule.findMany({
        where,
        include: SCHEDULE_INCLUDE,
        skip,
        take: limit,
        orderBy: [{ academicYear: 'desc' }, { semester: 'desc' }, { createdAt: 'desc' }],
      }),
      this.tenantPrisma.client.schedule.count({ where }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const schedule = await this.tenantPrisma.client.schedule.findFirst({
      where: { id, deletedAt: null },
      include: SCHEDULE_INCLUDE,
    });
    if (!schedule) throw new NotFoundException(`Schedule ${id} not found`);
    return schedule;
  }

  async findByClass(classroomId: string, academicYear?: string, semester?: number) {
    return this.tenantPrisma.client.schedule.findMany({
      where: {
        classroomId,
        deletedAt: null,
        status: { not: 'archived' },
        ...(academicYear ? { academicYear } : {}),
        ...(semester ? { semester } : {}),
      },
      include: SCHEDULE_INCLUDE,
      orderBy: [{ academicYear: 'desc' }, { semester: 'desc' }],
    });
  }

  async findByTeacher(teacherProfileId: string, academicYear?: string, semester?: number) {
    return this.tenantPrisma.client.schedule.findMany({
      where: {
        deletedAt: null,
        status: { not: 'archived' },
        ...(academicYear ? { academicYear } : {}),
        ...(semester ? { semester } : {}),
        entries: { some: { teacherProfileId, deletedAt: null } },
      },
      include: SCHEDULE_INCLUDE,
      orderBy: [{ academicYear: 'desc' }, { semester: 'desc' }],
    });
  }

  async findByStudent(studentProfileId: string, academicYear?: string, semester?: number) {
    const enrollments = await this.tenantPrisma.client.enrollment.findMany({
      where: {
        studentProfileId,
        status: 'active',
        ...(academicYear ? { classroom: { academicYear } } : {}),
      },
      select: { classroomId: true },
    });

    const classroomIds = enrollments.map((e) => e.classroomId);
    if (!classroomIds.length) return [];

    return this.tenantPrisma.client.schedule.findMany({
      where: {
        classroomId: { in: classroomIds },
        deletedAt: null,
        status: { not: 'archived' },
        ...(academicYear ? { academicYear } : {}),
        ...(semester ? { semester } : {}),
      },
      include: SCHEDULE_INCLUDE,
      orderBy: [{ academicYear: 'desc' }, { semester: 'desc' }],
    });
  }

  async create(dto: CreateScheduleDto) {
    await this.ensureClassroom(dto.classroomId);
    return this.tenantPrisma.client.schedule.create({
      data: {
        classroomId: dto.classroomId,
        academicYear: dto.academicYear,
        semester: dto.semester,
        status: dto.status,
        copiedFromScheduleId: dto.copiedFromScheduleId,
      },
      include: SCHEDULE_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateScheduleDto) {
    const existing = await this.findOne(id);
    if (dto.classroomId) await this.ensureClassroom(dto.classroomId);

    return this.tenantPrisma.client.schedule.update({
      where: { id },
      data: {
        classroomId: dto.classroomId,
        academicYear: dto.academicYear,
        semester: dto.semester,
        status: dto.status,
        publishedAt: dto.status === 'published' && existing.status !== 'published' ? new Date() : undefined,
        archivedAt: dto.status === 'archived' && existing.status !== 'archived' ? new Date() : undefined,
        copiedFromScheduleId: dto.copiedFromScheduleId,
      },
      include: SCHEDULE_INCLUDE,
    });
  }

  async publish(id: string) {
    await this.findOne(id);
    return this.tenantPrisma.client.schedule.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date() },
      include: SCHEDULE_INCLUDE,
    });
  }

  async archive(id: string) {
    await this.findOne(id);
    return this.tenantPrisma.client.schedule.update({
      where: { id },
      data: { status: 'archived', archivedAt: new Date(), deletedAt: new Date() },
      include: SCHEDULE_INCLUDE,
    });
  }

  async remove(id: string) {
    return this.archive(id);
  }

  async addEntry(scheduleId: string, dto: CreateScheduleEntryDto) {
    const schedule = await this.findOne(scheduleId);
    await this.validateEntryReferences(dto);
    await this.checkEntryConflicts(scheduleId, dto, schedule.id);

    return this.tenantPrisma.client.scheduleEntry.create({
      data: { scheduleId, ...dto },
      include: ENTRY_INCLUDE,
    });
  }

  async updateEntry(scheduleId: string, entryId: string, dto: UpdateScheduleEntryDto) {
    const schedule = await this.findOne(scheduleId);
    const existing = await this.tenantPrisma.client.scheduleEntry.findFirst({
      where: { id: entryId, scheduleId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException(`Schedule entry ${entryId} not found`);

    const merged = {
      subjectId: dto.subjectId ?? existing.subjectId,
      teacherProfileId: dto.teacherProfileId ?? existing.teacherProfileId,
      roomId: dto.roomId ?? existing.roomId,
      dayOfWeek: dto.dayOfWeek ?? existing.dayOfWeek ?? undefined,
      periodRowId: dto.periodRowId ?? existing.periodRowId ?? undefined,
      notes: dto.notes ?? existing.notes ?? undefined,
    };

    await this.validateEntryReferences(merged);
    await this.checkEntryConflicts(scheduleId, merged, schedule.id, entryId);

    return this.tenantPrisma.client.scheduleEntry.update({
      where: { id: entryId },
      data: dto,
      include: ENTRY_INCLUDE,
    });
  }

  async removeEntry(scheduleId: string, entryId: string) {
    const existing = await this.tenantPrisma.client.scheduleEntry.findFirst({
      where: { id: entryId, scheduleId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException(`Schedule entry ${entryId} not found`);
    return this.tenantPrisma.client.scheduleEntry.update({
      where: { id: entryId },
      data: { deletedAt: new Date() },
      include: ENTRY_INCLUDE,
    });
  }

  async listPeriodTemplates() {
    const templates = await this.tenantPrisma.client.periodTemplate.findMany({
      include: { rows: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ academicYear: 'desc' }, { gradeLevel: 'asc' }],
    });
    return templates.map((template) => this.withDerivedPeriodTimes(template));
  }

  async createPeriodTemplate(dto: CreatePeriodTemplateDto) {
    const template = await this.tenantPrisma.client.periodTemplate.create({
      data: dto,
      include: { rows: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.withDerivedPeriodTimes(template);
  }

  async updatePeriodTemplate(id: string, dto: UpdatePeriodTemplateDto) {
    const template = await this.tenantPrisma.client.periodTemplate.update({
      where: { id },
      data: dto,
      include: { rows: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.withDerivedPeriodTimes(template);
  }

  async addPeriodRow(templateId: string, dto: CreatePeriodRowDto) {
    await this.tenantPrisma.client.periodTemplate.findUniqueOrThrow({ where: { id: templateId } });
    const row = await this.tenantPrisma.client.periodRow.create({
      data: { templateId, ...dto, activeDays: dto.activeDays ?? [] },
    });
    return row;
  }

  async updatePeriodRow(id: string, dto: UpdatePeriodRowDto) {
    return this.tenantPrisma.client.periodRow.update({
      where: { id },
      data: dto,
    });
  }

  async removePeriodRow(id: string) {
    return this.tenantPrisma.client.periodRow.delete({ where: { id } });
  }

  private async ensureClassroom(classroomId: string) {
    const classroom = await this.tenantPrisma.client.classroom.findFirst({
      where: { id: classroomId, deletedAt: null },
      select: { id: true },
    });
    if (!classroom) throw new NotFoundException(`Classroom ${classroomId} not found`);
  }

  private async validateEntryReferences(dto: CreateScheduleEntryDto) {
    const [subject, teacher, room] = await Promise.all([
      this.tenantPrisma.client.subject.findFirst({ where: { id: dto.subjectId, deletedAt: null }, select: { id: true } }),
      this.tenantPrisma.client.teacherProfile.findFirst({ where: { id: dto.teacherProfileId, status: 'active', deletedAt: null }, select: { id: true } }),
      this.tenantPrisma.client.room.findFirst({ where: { id: dto.roomId, deletedAt: null }, select: { id: true } }),
    ]);

    if (!subject) throw new NotFoundException(`Subject ${dto.subjectId} not found`);
    if (!teacher) throw new NotFoundException(`Active teacher profile ${dto.teacherProfileId} not found`);
    if (!room) throw new NotFoundException(`Room ${dto.roomId} not found`);

    const isPlaced = dto.dayOfWeek !== undefined || dto.periodRowId !== undefined;
    const hasFullPlacement = dto.dayOfWeek !== undefined && dto.periodRowId !== undefined;
    if (isPlaced && !hasFullPlacement) {
      throw new BadRequestException('Placed entries require both dayOfWeek and periodRowId; omit both for tray items');
    }

    if (dto.periodRowId) {
      const period = await this.tenantPrisma.client.periodRow.findUnique({ where: { id: dto.periodRowId } });
      if (!period) throw new NotFoundException(`Period row ${dto.periodRowId} not found`);
    }
  }

  private async checkEntryConflicts(
    scheduleId: string,
    dto: CreateScheduleEntryDto,
    _scheduleIdForPublishedScope: string,
    excludeEntryId?: string,
  ) {
    if (!dto.dayOfWeek || !dto.periodRowId) return;

    const base = {
      dayOfWeek: dto.dayOfWeek,
      periodRowId: dto.periodRowId,
      deletedAt: null,
      ...(excludeEntryId ? { NOT: { id: excludeEntryId } } : {}),
    };

    const [cellConflict, teacherConflict, roomConflict] = await Promise.all([
      this.tenantPrisma.client.scheduleEntry.findFirst({
        where: { ...base, scheduleId },
        select: { id: true },
      }),
      this.tenantPrisma.client.scheduleEntry.findFirst({
        where: { ...base, teacherProfileId: dto.teacherProfileId, schedule: { status: { not: 'archived' }, deletedAt: null } },
        select: { id: true },
      }),
      this.tenantPrisma.client.scheduleEntry.findFirst({
        where: { ...base, roomId: dto.roomId, schedule: { status: { not: 'archived' }, deletedAt: null } },
        select: { id: true },
      }),
    ]);

    if (cellConflict) throw new ConflictException('This schedule already has a block in that day and period');
    if (teacherConflict) throw new ConflictException('This teacher already has a block in that day and period');
    if (roomConflict) throw new ConflictException('This room already has a block in that day and period');
  }

  private withDerivedPeriodTimes<T extends { dayStart: string; rows: Array<{ durationMin: number }> }>(template: T) {
    let cursor = this.timeToMinutes(template.dayStart);
    return {
      ...template,
      rows: template.rows.map((row) => {
        const startTime = this.minutesToTime(cursor);
        cursor += row.durationMin;
        return { ...row, startTime, endTime: this.minutesToTime(cursor) };
      }),
    };
  }

  private timeToMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minutesToTime(value: number): string {
    const hours = Math.floor(value / 60) % 24;
    const minutes = value % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
}

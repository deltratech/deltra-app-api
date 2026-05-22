import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { DayOfWeek } from '../common/enums/day-of-week.enum';
import { ScheduleStatus } from '../common/enums/schedule-status.enum';
import { paginatedResult } from '../common/utils/paginate';

const SCHEDULE_INCLUDE = {
  classroom:  { select: { id: true, name: true, gradeLevel: true, academicYear: true, semester: true } },
  subject:    { select: { id: true, code: true, name: true } },
  teacher:    { select: { id: true, nuptk: true, user: { select: { id: true, fullName: true } } } },
  room:       { select: { id: true, name: true, capacity: true } },
  timeSlot:   true,
};

@Injectable()
export class SchedulesService {
  constructor(private readonly tenantPrisma: PrismaTenantService) {}

  async findAll(filters: {
    classroomId?:      string;
    teacherProfileId?: string;
    academicYear?:     string;
    semester?:         number;
    dayOfWeek?:        DayOfWeek;
    status?:           ScheduleStatus;
    page?:             number;
    limit?:            number;
    search?:           string;
  }) {
    const { classroomId, teacherProfileId, academicYear, semester, dayOfWeek, status, page = 1, limit = 20, search } = filters;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(classroomId      ? { classroomId }      : {}),
      ...(teacherProfileId ? { teacherProfileId } : {}),
      ...(academicYear     ? { academicYear }     : {}),
      ...(semester         ? { semester }         : {}),
      ...(dayOfWeek        ? { dayOfWeek }        : {}),
      ...(status           ? { status }           : {}),
      ...(search ? {
        OR: [
          { classroom: { name: { contains: search, mode: 'insensitive' as const } } },
          { subject:   { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.tenantPrisma.client.schedule.findMany({
        where, include: SCHEDULE_INCLUDE, skip, take: limit,
        orderBy: [{ dayOfWeek: 'asc' }, { timeSlot: { sortOrder: 'asc' } }],
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
        ...(semester     ? { semester }     : {}),
      },
      include: SCHEDULE_INCLUDE,
      orderBy: [
        { dayOfWeek: 'asc' },
        { timeSlot: { sortOrder: 'asc' } },
      ],
    });
  }

  async findByTeacher(teacherProfileId: string, academicYear?: string, semester?: number) {
    return this.tenantPrisma.client.schedule.findMany({
      where: {
        teacherProfileId,
        deletedAt: null,
        status: { not: 'archived' },
        ...(academicYear ? { academicYear } : {}),
        ...(semester     ? { semester }     : {}),
      },
      include: SCHEDULE_INCLUDE,
      orderBy: [
        { dayOfWeek: 'asc' },
        { timeSlot: { sortOrder: 'asc' } },
      ],
    });
  }

  async findByStudent(studentProfileId: string, academicYear?: string, semester?: number) {
    const enrollments = await this.tenantPrisma.client.enrollment.findMany({
      where: {
        studentProfileId,
        status: 'active',
        ...(academicYear
          ? { classroom: { academicYear } }
          : {}),
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
        ...(semester     ? { semester }     : {}),
      },
      include: SCHEDULE_INCLUDE,
      orderBy: [
        { dayOfWeek: 'asc' },
        { timeSlot: { sortOrder: 'asc' } },
      ],
    });
  }

  async create(dto: CreateScheduleDto) {
    await this.checkConflicts(dto);

    return this.tenantPrisma.client.schedule.create({
      data: {
        classroomId:      dto.classroomId,
        subjectId:        dto.subjectId,
        teacherProfileId: dto.teacherProfileId,
        roomId:           dto.roomId,
        timeSlotId:       dto.timeSlotId,
        dayOfWeek:        dto.dayOfWeek,
        academicYear:     dto.academicYear,
        semester:         dto.semester,
        status:           dto.status,
        notes:            dto.notes,
      },
      include: SCHEDULE_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateScheduleDto) {
    const existing = await this.findOne(id);

    const merged = {
      classroomId:      dto.classroomId      ?? existing.classroomId,
      subjectId:        dto.subjectId        ?? existing.subjectId,
      teacherProfileId: dto.teacherProfileId ?? existing.teacherProfileId,
      roomId:           dto.roomId           ?? existing.roomId,
      timeSlotId:       dto.timeSlotId       ?? existing.timeSlotId,
      dayOfWeek:        dto.dayOfWeek        ?? existing.dayOfWeek,
      academicYear:     dto.academicYear     ?? existing.academicYear,
      semester:         dto.semester         ?? existing.semester,
      status:           dto.status           ?? existing.status,
    };

    await this.checkConflicts(merged as CreateScheduleDto, id);

    return this.tenantPrisma.client.schedule.update({
      where: { id },
      data: {
        ...merged,
        notes: dto.notes ?? existing.notes,
      },
      include: SCHEDULE_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.tenantPrisma.client.schedule.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'archived' },
    });
  }

  // ── Conflict validation ───────────────────────────────────────────────────────

  private async checkConflicts(dto: CreateScheduleDto, excludeId?: string) {
    const base = {
      dayOfWeek:    dto.dayOfWeek,
      timeSlotId:   dto.timeSlotId,
      academicYear: dto.academicYear,
      semester:     dto.semester,
      status:       { not: 'archived' as const },
      deletedAt:    null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    };

    const [classConflict, teacherConflict, roomConflict] = await Promise.all([
      this.tenantPrisma.client.schedule.findFirst({
        where: { ...base, classroomId: dto.classroomId },
        select: { id: true },
      }),
      dto.teacherProfileId
        ? this.tenantPrisma.client.schedule.findFirst({
            where: { ...base, teacherProfileId: dto.teacherProfileId },
            select: { id: true },
          })
        : Promise.resolve(null),
      dto.roomId
        ? this.tenantPrisma.client.schedule.findFirst({
            where: { ...base, roomId: dto.roomId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (classConflict)
      throw new ConflictException('This class already has a schedule at this day and time slot');
    if (teacherConflict)
      throw new ConflictException('This teacher already has a schedule at this day and time slot');
    if (roomConflict)
      throw new ConflictException('This room already has a schedule at this day and time slot');
  }
}

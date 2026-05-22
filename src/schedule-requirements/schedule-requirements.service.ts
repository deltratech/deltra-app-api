import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { CreateRequirementDto } from './dto/create-requirement.dto';
import { UpdateRequirementDto } from './dto/update-requirement.dto';

@Injectable()
export class ScheduleRequirementsService {
  constructor(private readonly tenantPrisma: PrismaTenantService) {}

  findAll(filters: { academicYear?: string; semester?: number; classroomId?: string }) {
    return this.tenantPrisma.client.scheduleRequirement.findMany({
      where: {
        ...(filters.academicYear ? { academicYear: filters.academicYear } : {}),
        ...(filters.semester     ? { semester: filters.semester }         : {}),
        ...(filters.classroomId  ? { classroomId: filters.classroomId }  : {}),
      },
      include: {
        classroom: { select: { id: true, name: true, gradeLevel: true } },
        subject:   { select: { id: true, code: true, name: true } },
        teacher:   { select: { id: true, nuptk: true, user: { select: { id: true, fullName: true } } } },
        room:      { select: { id: true, name: true } },
      },
      orderBy: [{ classroom: { name: 'asc' } }, { sessionsPerWeek: 'desc' }],
    });
  }

  async findOne(id: string) {
    const req = await this.tenantPrisma.client.scheduleRequirement.findUnique({
      where: { id },
      include: {
        classroom: { select: { id: true, name: true } },
        subject:   { select: { id: true, code: true, name: true } },
        teacher:   { select: { id: true, user: { select: { id: true, fullName: true } } } },
        room:      { select: { id: true, name: true } },
      },
    });
    if (!req) throw new NotFoundException(`Requirement ${id} not found`);
    return req;
  }

  async create(dto: CreateRequirementDto) {
    const exists = await this.tenantPrisma.client.scheduleRequirement.findUnique({
      where: {
        classroomId_subjectId_academicYear_semester: {
          classroomId:  dto.classroomId,
          subjectId:    dto.subjectId,
          academicYear: dto.academicYear,
          semester:     dto.semester,
        },
      },
    });
    if (exists) throw new ConflictException('Requirement for this class/subject/year/semester already exists');

    return this.tenantPrisma.client.scheduleRequirement.create({
      data: dto,
      include: {
        classroom: { select: { id: true, name: true } },
        subject:   { select: { id: true, code: true, name: true } },
        teacher:   { select: { id: true, user: { select: { id: true, fullName: true } } } },
        room:      { select: { id: true, name: true } },
      },
    });
  }

  async update(id: string, dto: UpdateRequirementDto) {
    await this.findOne(id);
    return this.tenantPrisma.client.scheduleRequirement.update({
      where: { id },
      data: dto,
      include: {
        classroom: { select: { id: true, name: true } },
        subject:   { select: { id: true, code: true, name: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.tenantPrisma.client.scheduleRequirement.delete({ where: { id } });
  }
}

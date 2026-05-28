import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { CreateHomeroomAssignmentDto } from './dto/create-homeroom-assignment.dto';
import { UpdateHomeroomAssignmentDto } from './dto/update-homeroom-assignment.dto';
import { paginatedResult } from '../common/utils/paginate';

const TEACHER_SELECT = {
  id: true,
  userId: true,
  status: true,
  photoUrl: true,
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      username: true,
      avatarUrl: true,
    },
  },
};

const ASSIGNMENT_INCLUDE = {
  classroom: { select: { id: true, name: true, gradeLevel: true, academicYear: true, semester: true } },
  teacher: { select: TEACHER_SELECT },
};

@Injectable()
export class HomeroomAssignmentsService {
  constructor(private readonly tenantPrisma: PrismaTenantService) {}

  async findAll(filters: { page?: number; limit?: number; classroomId?: string; active?: boolean } = {}) {
    const { page = 1, limit = 20, classroomId, active } = filters;
    const skip = (page - 1) * limit;
    const where = {
      deletedAt: null,
      ...(classroomId ? { classroomId } : {}),
      ...(active !== undefined ? { isActive: active } : {}),
    };

    const [data, total] = await Promise.all([
      this.tenantPrisma.client.homeroomAssignment.findMany({
        where,
        include: ASSIGNMENT_INCLUDE,
        skip,
        take: limit,
        orderBy: { assignedAt: 'desc' },
      }),
      this.tenantPrisma.client.homeroomAssignment.count({ where }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const assignment = await this.tenantPrisma.client.homeroomAssignment.findFirst({
      where: { id, deletedAt: null },
      include: ASSIGNMENT_INCLUDE,
    });
    if (!assignment) throw new NotFoundException(`Homeroom assignment ${id} not found`);
    return assignment;
  }

  async getClassroomDetail(classroomId: string) {
    const classroom = await this.tenantPrisma.client.classroom.findFirst({
      where: { id: classroomId, deletedAt: null },
      include: {
        homeroomAssignments: {
          where: { deletedAt: null },
          include: { teacher: { select: TEACHER_SELECT } },
          orderBy: { assignedAt: 'desc' },
        },
        enrollments: {
          where: { status: 'active' },
          select: { id: true, studentProfileId: true },
        },
      },
    });
    if (!classroom) throw new NotFoundException(`Classroom ${classroomId} not found`);

    const currentHomeroom = classroom.homeroomAssignments.find((assignment) => assignment.isActive) ?? null;
    return {
      ...classroom,
      currentHomeroom,
      studentCount: classroom.enrollments.length,
    };
  }

  async create(dto: CreateHomeroomAssignmentDto) {
    const [classroom, teacher] = await Promise.all([
      this.tenantPrisma.client.classroom.findFirst({ where: { id: dto.classroomId, deletedAt: null } }),
      this.tenantPrisma.client.teacherProfile.findFirst({
        where: { id: dto.teacherProfileId, status: 'active', deletedAt: null },
      }),
    ]);

    if (!classroom) throw new NotFoundException(`Classroom ${dto.classroomId} not found`);
    if (!teacher) throw new NotFoundException(`Active teacher profile ${dto.teacherProfileId} not found`);

    const activeAssignment = await this.tenantPrisma.client.homeroomAssignment.findFirst({
      where: { classroomId: dto.classroomId, isActive: true, deletedAt: null },
    });

    if (activeAssignment?.teacherProfileId === dto.teacherProfileId) {
      throw new ConflictException('This teacher is already the active homeroom teacher for this classroom');
    }

    return this.tenantPrisma.client.$transaction(async (tx) => {
      if (activeAssignment) {
        await tx.homeroomAssignment.update({
          where: { id: activeAssignment.id },
          data: { isActive: false, endedAt: new Date() },
        });
      }

      const assignment = await tx.homeroomAssignment.create({
        data: {
          classroomId: dto.classroomId,
          teacherProfileId: dto.teacherProfileId,
          academicYear: dto.academicYear,
          semester: dto.semester,
          notes: dto.notes,
        },
        include: ASSIGNMENT_INCLUDE,
      });

      await tx.classroom.update({
        where: { id: dto.classroomId },
        data: { homeroomUserId: teacher.userId },
      });

      return assignment;
    });
  }

  async update(id: string, dto: UpdateHomeroomAssignmentDto) {
    const existing = await this.findOne(id);

    if (dto.classroomId || dto.teacherProfileId) {
      const teacherProfileId = dto.teacherProfileId ?? existing.teacherProfileId;
      const teacher = await this.tenantPrisma.client.teacherProfile.findFirst({
        where: { id: teacherProfileId, status: 'active', deletedAt: null },
      });
      if (!teacher) throw new NotFoundException(`Active teacher profile ${teacherProfileId} not found`);

      const classroomId = dto.classroomId ?? existing.classroomId;
      const classroom = await this.tenantPrisma.client.classroom.findFirst({
        where: { id: classroomId, deletedAt: null },
      });
      if (!classroom) throw new NotFoundException(`Classroom ${classroomId} not found`);
    }

    return this.tenantPrisma.client.homeroomAssignment.update({
      where: { id },
      data: {
        classroomId: dto.classroomId,
        teacherProfileId: dto.teacherProfileId,
        academicYear: dto.academicYear,
        semester: dto.semester,
        notes: dto.notes,
      },
      include: ASSIGNMENT_INCLUDE,
    });
  }

  async deactivate(id: string) {
    const existing = await this.findOne(id);
    const endedAt = new Date();

    return this.tenantPrisma.client.$transaction(async (tx) => {
      const assignment = await tx.homeroomAssignment.update({
        where: { id },
        data: { isActive: false, endedAt },
        include: ASSIGNMENT_INCLUDE,
      });

      if (existing.isActive) {
        await tx.classroom.update({
          where: { id: existing.classroomId },
          data: { homeroomUserId: null },
        });
      }

      return assignment;
    });
  }

  async remove(id: string) {
    const existing = await this.findOne(id);
    const deletedAt = new Date();

    return this.tenantPrisma.client.$transaction(async (tx) => {
      const assignment = await tx.homeroomAssignment.update({
        where: { id },
        data: {
          isActive: false,
          endedAt: existing.endedAt ?? deletedAt,
          deletedAt,
        },
        include: ASSIGNMENT_INCLUDE,
      });

      if (existing.isActive) {
        await tx.classroom.update({
          where: { id: existing.classroomId },
          data: { homeroomUserId: null },
        });
      }

      return assignment;
    });
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { paginatedResult } from '../common/utils/paginate';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { UpdateClassroomDto } from './dto/update-classroom.dto';

@Injectable()
export class ClassroomsService {
  constructor(private readonly tenantPrisma: PrismaTenantService) {}

  async findAll(filters: {
    page?: number;
    limit?: number;
    search?: string;
    academicYear?: string;
    semester?: number;
    gradeLevel?: number;
  } = {}) {
    const { page = 1, limit = 20, search, academicYear, semester, gradeLevel } = filters;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(academicYear ? { academicYear } : {}),
      ...(semester ? { semester } : {}),
      ...(gradeLevel ? { gradeLevel } : {}),
    };

    const [data, total] = await Promise.all([
      this.tenantPrisma.client.classroom.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ academicYear: 'desc' }, { gradeLevel: 'asc' }, { name: 'asc' }],
        include: {
          _count: {
            select: {
              enrollments: true,
              schedules: true,
              homeroomAssignments: true,
            },
          },
        },
      }),
      this.tenantPrisma.client.classroom.count({ where }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const classroom = await this.tenantPrisma.client.classroom.findFirst({
      where: { id, deletedAt: null },
      include: {
        enrollments: {
          where: { status: 'active' },
          select: {
            id: true,
            studentProfileId: true,
            status: true,
          },
        },
        schedules: {
          where: { deletedAt: null },
          select: {
            id: true,
            academicYear: true,
            semester: true,
            status: true,
            publishedAt: true,
            archivedAt: true,
          },
          orderBy: [{ academicYear: 'desc' }, { semester: 'asc' }],
        },
        homeroomAssignments: {
          where: { deletedAt: null },
          include: {
            teacher: {
              include: {
                user: { select: { id: true, fullName: true, email: true, status: true } },
              },
            },
          },
          orderBy: [{ isActive: 'desc' }, { assignedAt: 'desc' }],
        },
      },
    });

    if (!classroom) throw new NotFoundException(`Classroom ${id} not found`);
    return classroom;
  }

  async create(dto: CreateClassroomDto) {
    await this.ensureUnique(dto.name, dto.academicYear, dto.semester);

    return this.tenantPrisma.client.classroom.create({
      data: dto,
    });
  }

  async update(id: string, dto: UpdateClassroomDto) {
    const existing = await this.findOne(id);

    const name = dto.name ?? existing.name;
    const academicYear = dto.academicYear ?? existing.academicYear;
    const semester = dto.semester ?? existing.semester;

    if (dto.name || dto.academicYear || dto.semester) {
      await this.ensureUnique(name, academicYear, semester, id);
    }

    return this.tenantPrisma.client.classroom.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.tenantPrisma.client.classroom.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async ensureUnique(name: string, academicYear: string, semester: number, excludeId?: string) {
    const conflict = await this.tenantPrisma.client.classroom.findFirst({
      where: {
        name,
        academicYear,
        semester,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });

    if (conflict) {
      throw new ConflictException(`Classroom '${name}' already exists for ${academicYear} semester ${semester}`);
    }
  }
}

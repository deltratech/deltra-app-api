import {
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { paginatedResult } from '../common/utils/paginate';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { UpdateClassroomDto } from './dto/update-classroom.dto';
import { AssignClassroomDto } from './dto/assign-classroom.dto';
import { UnassignClassroomDto } from './dto/unassign-classroom.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { AssignMultipleStudentClassroomDto } from './dto/assign-multiple-student-classroom.dto';

const ACADEMIC_YEAR_SELECT = {
  id: true,
  label: true,
  semester: true,
  startDate: true,
  endDate: true,
  isActive: true,
};

type CurrentUserContext = { userId: string; role?: UserRole };

@Injectable()
export class ClassroomsService {
  constructor(private readonly tenantPrisma: PrismaTenantService) {}

  private requireRole(actor: CurrentUserContext, roles: UserRole[]) {
    if (!actor?.userId || !roles.includes(actor.role as UserRole)) {
      throw new ForbiddenException(
        'You are not allowed to access this classroom resource',
      );
    }
  }

  async findAll(
    filters: {
      page?: number;
      limit?: number;
      search?: string;
      academicYearId?: string;
      gradeLevel?: number;
    } = {},
  ) {
    const {
      page = 1,
      limit = 20,
      search,
      academicYearId,
      gradeLevel,
    } = filters;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(search
        ? { name: { contains: search, mode: 'insensitive' as const } }
        : {}),
      ...(academicYearId ? { academicYearId } : {}),
      ...(gradeLevel ? { gradeLevel } : {}),
    };

    const [data, total] = await Promise.all([
      this.tenantPrisma.client.classroom.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { academicYear: { label: 'desc' as const } },
          { gradeLevel: 'asc' },
          { name: 'asc' },
        ],
        include: {
          academicYear: { select: ACADEMIC_YEAR_SELECT },
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
        academicYear: { select: ACADEMIC_YEAR_SELECT },
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
            academicYearId: true,
            status: true,
            publishedAt: true,
            archivedAt: true,
          },
          orderBy: [
            { academicYear: { label: 'desc' as const } },
            { academicYear: { semester: 'asc' as const } },
          ],
        },
        homeroomAssignments: {
          where: { deletedAt: null },
          include: {
            teacher: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    status: true,
                  },
                },
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
    await this.ensureUnique(dto.name, dto.academicYearId);

    return this.tenantPrisma.client.classroom.create({
      data: dto,
      include: { academicYear: { select: ACADEMIC_YEAR_SELECT } },
    });
  }

  async update(id: string, dto: UpdateClassroomDto) {
    const existing = await this.findOne(id);

    const name = dto.name ?? existing.name;
    const academicYearId = dto.academicYearId ?? existing.academicYearId;

    if (dto.name || dto.academicYearId) {
      await this.ensureUnique(name, academicYearId, id);
    }

    return this.tenantPrisma.client.classroom.update({
      where: { id },
      data: dto,
      include: { academicYear: { select: ACADEMIC_YEAR_SELECT } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.tenantPrisma.client.classroom.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async assignMultipleStudents(
    actor: CurrentUserContext,
    classroomId: string,
    dto: AssignMultipleStudentClassroomDto,
  ) {
    this.requireRole(actor, [UserRole.school_admin, UserRole.teacher]);
    // check teacher is assigned to the classroom if role is teacher
    if (actor.role === UserRole.teacher) {
      const isAssigned =
        await this.tenantPrisma.client.homeroomAssignment.findFirst({
          where: {
            classroomId,
            teacher: { userId: actor.userId },
            deletedAt: null,
          },
        });
      if (!isAssigned) {
        throw new ForbiddenException(
          'You can only assign students to classrooms you are assigned to as homeroom teacher',
        );
      }
    }
    const classroom = await this.findOne(classroomId);
    const studentProfiles =
      await this.tenantPrisma.client.studentProfile.findMany({
        where: { id: { in: dto.studentProfileIds } },
      });
    const activeElsewhere = await this.tenantPrisma.client.enrollment.findMany({
      where: {
        studentProfileId: { in: dto.studentProfileIds },
        status: 'active' as const,
      },
    });
    if (activeElsewhere.length > 0) {
      const activeIds = activeElsewhere.map((e) => e.studentProfileId);
      throw new ConflictException(
        `Student profiles already actively enrolled in other classrooms: ${activeIds.join(
          ', ',
        )}`,
      );
    }

    if (!classroom) {
      throw new NotFoundException(`Classroom ${classroomId} not found`);
    }

    if (studentProfiles.length !== dto.studentProfileIds.length) {
      const foundIds = studentProfiles.map((sp) => sp.id);
      const notFoundIds = dto.studentProfileIds.filter(
        (id) => !foundIds.includes(id),
      );
      throw new NotFoundException(
        `Student profiles not found: ${notFoundIds.join(', ')}`,
      );
    }

    const enrollmentsData = dto.studentProfileIds.map((studentProfileId) => ({
      classroomId: classroomId,
      studentProfileId,
      status: 'active' as const,
    }));

    //use client.$transaction with upsert to create or update enrollments in bulk
    return this.tenantPrisma.client.$transaction(async (tx) => {
      return Promise.all(
        enrollmentsData.map((enrollment) =>
          tx.enrollment.upsert({
            where: {
              studentProfileId_classroomId: {
                studentProfileId: enrollment.studentProfileId,
                classroomId: enrollment.classroomId,
              },
            },
            update: { status: 'active' },
            create: enrollment,
          }),
        ),
      );
    });
  }

  async assignStudent(
    actor: CurrentUserContext,
    classroomId: string,
    dto: AssignClassroomDto,
  ) {
    this.requireRole(actor, [UserRole.school_admin, UserRole.teacher]);
    if (actor.role === UserRole.teacher) {
      const isAssigned =
        await this.tenantPrisma.client.homeroomAssignment.findFirst({
          where: {
            classroomId,
            teacher: { userId: actor.userId },
            deletedAt: null,
          },
        });
      if (!isAssigned) {
        throw new ForbiddenException(
          'You can only assign students to classrooms you are assigned to as homeroom teacher',
        );
      }
    }
    const classroom = await this.findOne(classroomId);
    const studentProfile =
      await this.tenantPrisma.client.studentProfile.findFirst({
        where: { id: dto.studentProfileId, status: 'active' },
      });

    const activeElsewhere = await this.tenantPrisma.client.enrollment.findFirst(
      {
        where: {
          studentProfileId: dto.studentProfileId,
          status: 'active' as const,
        },
      },
    );
    if (activeElsewhere) {
      throw new ConflictException(
        `Student profile ${activeElsewhere.studentProfileId} is already actively enrolled in classroom ${activeElsewhere.classroomId}`,
      );
    }

    if (!classroom) {
      throw new NotFoundException(`Classroom ${classroomId} not found`);
    }
    if (!studentProfile) {
      throw new NotFoundException(
        `Student profile ${dto.studentProfileId} not found`,
      );
    }

    return this.tenantPrisma.client.enrollment.upsert({
      where: {
        studentProfileId_classroomId: {
          studentProfileId: dto.studentProfileId,
          classroomId,
        },
      },
      update: { status: 'active' },
      create: {
        studentProfileId: dto.studentProfileId,
        classroomId,
        status: 'active',
      },
    });
  }

  async unassignStudent(
    actor: CurrentUserContext,
    classroomId: string,
    dto: UnassignClassroomDto,
  ) {
    this.requireRole(actor, [UserRole.school_admin, UserRole.teacher]);
    if (actor.role === UserRole.teacher) {
      const isAssigned =
        await this.tenantPrisma.client.homeroomAssignment.findFirst({
          where: {
            classroomId,
            teacher: { userId: actor.userId },
            deletedAt: null,
          },
        });
      if (!isAssigned) {
        throw new ForbiddenException(
          'You can only unassign students from classrooms you are assigned to as homeroom teacher',
        );
      }
    }
    const enrollment = await this.tenantPrisma.client.enrollment.findFirst({
      where: {
        classroomId: classroomId,
        studentProfileId: dto.studentProfileId,
        status: 'active',
      },
    });

    if (!enrollment) {
      throw new NotFoundException(
        `Active enrollment for student profile ${dto.studentProfileId} in classroom ${classroomId} not found`,
      );
    }

    return this.tenantPrisma.client.enrollment.update({
      where: { id: enrollment.id },
      data: { status: dto.status },
    });
  }

  private async ensureUnique(
    name: string,
    academicYearId: string,
    excludeId?: string,
  ) {
    const conflict = await this.tenantPrisma.client.classroom.findFirst({
      where: {
        name,
        academicYearId,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });

    if (conflict) {
      throw new ConflictException(
        `Classroom '${name}' already exists for academic year ${academicYearId}`,
      );
    }
  }
}

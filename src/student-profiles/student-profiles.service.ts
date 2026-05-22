import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { StorageService } from '../storage/storage.service';
import { CreateStudentProfileDto } from './dto/create-student-profile.dto';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';
import { StudentStatus } from '../common/enums/student-status.enum';
import { paginatedResult } from '../common/utils/paginate';

const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  avatarUrl: true,
  role: true,
};

const PROFILE_INCLUDE = {
  user: { select: USER_SELECT },
  guardians: { orderBy: { isPrimary: 'desc' as const } },
  enrollments: {
    where: { status: 'active' as const },
    include: {
      classroom: {
        select: { id: true, name: true, gradeLevel: true, academicYear: true, semester: true },
      },
    },
  },
};

@Injectable()
export class StudentProfilesService {
  constructor(
    private readonly tenantPrisma: PrismaTenantService,
    private readonly storage: StorageService,
  ) {}

  async findAll(filters: { status?: StudentStatus; page?: number; limit?: number; search?: string } = {}) {
    const { status, page = 1, limit = 20, search } = filters;
    const skip = (page - 1) * limit;

    const where = {
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { user: { fullName: { contains: search, mode: 'insensitive' as const } } },
          { nisn: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.tenantPrisma.client.studentProfile.findMany({ where, include: PROFILE_INCLUDE, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.tenantPrisma.client.studentProfile.count({ where }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const profile = await this.tenantPrisma.client.studentProfile.findUnique({
      where: { id },
      include: PROFILE_INCLUDE,
    });
    if (!profile) throw new NotFoundException(`Student profile ${id} not found`);
    return profile;
  }

  async findByUserId(userId: string) {
    const profile = await this.tenantPrisma.client.studentProfile.findUnique({
      where: { userId },
      include: PROFILE_INCLUDE,
    });
    if (!profile) throw new NotFoundException(`Student profile for user ${userId} not found`);
    return profile;
  }

  async create(dto: CreateStudentProfileDto) {
    const exists = await this.tenantPrisma.client.studentProfile.findUnique({
      where: { userId: dto.userId },
    });
    if (exists) throw new ConflictException(`Student profile for user ${dto.userId} already exists`);

    if (dto.nisn) {
      const nisnTaken = await this.tenantPrisma.client.studentProfile.findUnique({ where: { nisn: dto.nisn } });
      if (nisnTaken) throw new ConflictException(`NISN '${dto.nisn}' is already registered`);
    }

    if (dto.nik) {
      const nikTaken = await this.tenantPrisma.client.studentProfile.findUnique({ where: { nik: dto.nik } });
      if (nikTaken) throw new ConflictException(`NIK '${dto.nik}' is already registered`);
    }

    return this.tenantPrisma.client.studentProfile.create({
      data: {
        userId:     dto.userId,
        nisn:       dto.nisn,
        nik:        dto.nik,
        birthDate:  dto.birthDate ? new Date(dto.birthDate) : undefined,
        birthPlace: dto.birthPlace,
        gender:     dto.gender,
        religion:   dto.religion,
        address:    dto.address,
        phone:      dto.phone,
        entryYear:  dto.entryYear,
        status:     dto.status,
      },
      include: PROFILE_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateStudentProfileDto) {
    await this.findOne(id);

    if (dto.nisn) {
      const nisnTaken = await this.tenantPrisma.client.studentProfile.findFirst({
        where: { nisn: dto.nisn, NOT: { id } },
      });
      if (nisnTaken) throw new ConflictException(`NISN '${dto.nisn}' is already registered`);
    }

    if (dto.nik) {
      const nikTaken = await this.tenantPrisma.client.studentProfile.findFirst({
        where: { nik: dto.nik, NOT: { id } },
      });
      if (nikTaken) throw new ConflictException(`NIK '${dto.nik}' is already registered`);
    }

    return this.tenantPrisma.client.studentProfile.update({
      where: { id },
      data: {
        nisn:       dto.nisn,
        nik:        dto.nik,
        birthDate:  dto.birthDate ? new Date(dto.birthDate) : undefined,
        birthPlace: dto.birthPlace,
        gender:     dto.gender,
        religion:   dto.religion,
        address:    dto.address,
        phone:      dto.phone,
        entryYear:  dto.entryYear,
        status:     dto.status,
      },
      include: PROFILE_INCLUDE,
    });
  }

  async updatePhoto(id: string, file: Express.Multer.File, tenantSlug: string) {
    const profile = await this.findOne(id);

    if (profile.photoUrl) await this.storage.delete(profile.photoUrl);

    const photoUrl = await this.storage.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      'student-photos',
      tenantSlug,
    );

    return this.tenantPrisma.client.studentProfile.update({
      where: { id },
      data: { photoUrl },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.tenantPrisma.client.studentProfile.delete({ where: { id } });
  }

  // ── Guardians ────────────────────────────────────────────────────────────────

  async addGuardian(studentProfileId: string, dto: CreateGuardianDto) {
    await this.findOne(studentProfileId);

    if (dto.isPrimary) {
      await this.tenantPrisma.client.guardian.updateMany({
        where: { studentProfileId },
        data: { isPrimary: false },
      });
    }

    return this.tenantPrisma.client.guardian.create({
      data: { studentProfileId, ...dto },
    });
  }

  async updateGuardian(studentProfileId: string, guardianId: string, dto: UpdateGuardianDto) {
    const guardian = await this.tenantPrisma.client.guardian.findFirst({
      where: { id: guardianId, studentProfileId },
    });
    if (!guardian) throw new NotFoundException(`Guardian ${guardianId} not found`);

    if (dto.isPrimary) {
      await this.tenantPrisma.client.guardian.updateMany({
        where: { studentProfileId, NOT: { id: guardianId } },
        data: { isPrimary: false },
      });
    }

    return this.tenantPrisma.client.guardian.update({
      where: { id: guardianId },
      data: dto,
    });
  }

  async removeGuardian(studentProfileId: string, guardianId: string) {
    const guardian = await this.tenantPrisma.client.guardian.findFirst({
      where: { id: guardianId, studentProfileId },
    });
    if (!guardian) throw new NotFoundException(`Guardian ${guardianId} not found`);

    return this.tenantPrisma.client.guardian.delete({ where: { id: guardianId } });
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { StorageService } from '../storage/storage.service';
import { CreateTeacherProfileDto } from './dto/create-teacher-profile.dto';
import { UpdateTeacherProfileDto } from './dto/update-teacher-profile.dto';
import { TeacherStatus } from '../common/enums/teacher-status.enum';
import { paginatedResult } from '../common/utils/paginate';

const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  avatarUrl: true,
  role: true,
};

const SUBJECT_INCLUDE = {
  classSubjects: {
    where: { classroom: { deletedAt: null } },
    include: {
      subject:   { select: { id: true, code: true, name: true } },
      classroom: { select: { id: true, name: true, academicYear: true, semester: true, gradeLevel: true } },
    },
  },
};

@Injectable()
export class TeacherProfilesService {
  constructor(
    private readonly tenantPrisma: PrismaTenantService,
    private readonly storage: StorageService,
  ) {}

  async findAll(filters: { status?: TeacherStatus; page?: number; limit?: number; search?: string } = {}) {
    const { status, page = 1, limit = 20, search } = filters;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { user:  { fullName: { contains: search, mode: 'insensitive' as const } } },
          { nuptk: { contains: search, mode: 'insensitive' as const } },
          { nik:   { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.tenantPrisma.client.teacherProfile.findMany({
        where,
        include: { user: { select: USER_SELECT }, ...SUBJECT_INCLUDE },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.tenantPrisma.client.teacherProfile.count({ where }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const profile = await this.tenantPrisma.client.teacherProfile.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: { select: USER_SELECT },
        ...SUBJECT_INCLUDE,
      },
    });
    if (!profile) throw new NotFoundException(`Teacher profile ${id} not found`);

    const homeroomClasses = await this.tenantPrisma.client.classroom.findMany({
      where: { homeroomUserId: profile.userId, deletedAt: null },
      select: { id: true, name: true, academicYear: true, semester: true, gradeLevel: true },
    });

    return { ...profile, homeroomClasses };
  }

  async findByUserId(userId: string) {
    const profile = await this.tenantPrisma.client.teacherProfile.findFirst({
      where: { userId, deletedAt: null },
      include: {
        user: { select: USER_SELECT },
        ...SUBJECT_INCLUDE,
      },
    });
    if (!profile) throw new NotFoundException(`Teacher profile for user ${userId} not found`);

    const homeroomClasses = await this.tenantPrisma.client.classroom.findMany({
      where: { homeroomUserId: userId, deletedAt: null },
      select: { id: true, name: true, academicYear: true, semester: true, gradeLevel: true },
    });

    return { ...profile, homeroomClasses };
  }

  async create(dto: CreateTeacherProfileDto) {
    const exists = await this.tenantPrisma.client.teacherProfile.findUnique({
      where: { userId: dto.userId },
    });
    if (exists) throw new ConflictException(`Teacher profile for user ${dto.userId} already exists`);

    if (dto.nik) {
      const nikTaken = await this.tenantPrisma.client.teacherProfile.findUnique({
        where: { nik: dto.nik },
      });
      if (nikTaken) throw new ConflictException(`NIK '${dto.nik}' is already registered`);
    }

    return this.tenantPrisma.client.teacherProfile.create({
      data: {
        userId:           dto.userId,
        nuptk:            dto.nuptk,
        nik:              dto.nik,
        birthDate:        dto.birthDate ? new Date(dto.birthDate) : undefined,
        birthPlace:       dto.birthPlace,
        gender:           dto.gender,
        religion:         dto.religion,
        phone:            dto.phone,
        email:            dto.email,
        employmentStatus: dto.employmentStatus,
        bio:              dto.bio,
        status:           dto.status,
      },
      include: {
        user: { select: USER_SELECT },
        ...SUBJECT_INCLUDE,
      },
    });
  }

  async update(id: string, dto: UpdateTeacherProfileDto) {
    await this.findOne(id);

    if (dto.nik) {
      const nikTaken = await this.tenantPrisma.client.teacherProfile.findFirst({
        where: { nik: dto.nik, NOT: { id } },
      });
      if (nikTaken) throw new ConflictException(`NIK '${dto.nik}' is already registered`);
    }

    return this.tenantPrisma.client.teacherProfile.update({
      where: { id },
      data: {
        nuptk:            dto.nuptk,
        nik:              dto.nik,
        birthDate:        dto.birthDate ? new Date(dto.birthDate) : undefined,
        birthPlace:       dto.birthPlace,
        gender:           dto.gender,
        religion:         dto.religion,
        phone:            dto.phone,
        email:            dto.email,
        employmentStatus: dto.employmentStatus,
        bio:              dto.bio,
        status:           dto.status,
      },
      include: {
        user: { select: USER_SELECT },
        ...SUBJECT_INCLUDE,
      },
    });
  }

  async updatePhoto(id: string, file: Express.Multer.File, tenantSlug: string) {
    const profile = await this.findOne(id);

    if (profile.photoUrl) await this.storage.delete(profile.photoUrl);

    const photoUrl = await this.storage.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      'teacher-photos',
      tenantSlug,
    );

    return this.tenantPrisma.client.teacherProfile.update({
      where: { id },
      data: { photoUrl },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.tenantPrisma.client.teacherProfile.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

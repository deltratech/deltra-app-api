import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';

@Injectable()
export class AcademicYearsService {
  constructor(private readonly tenantPrisma: PrismaTenantService) {}

  findAll(filters: { activeOnly?: boolean } = {}) {
    return this.tenantPrisma.client.academicYear.findMany({
      where: filters.activeOnly ? { isActive: true } : undefined,
      orderBy: [{ label: 'desc' }, { semester: 'asc' }],
    });
  }

  async findOne(id: string) {
    const ay = await this.tenantPrisma.client.academicYear.findUnique({ where: { id } });
    if (!ay) throw new NotFoundException(`Academic year ${id} not found`);
    return ay;
  }

  async create(dto: CreateAcademicYearDto) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (start >= end) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const exists = await this.tenantPrisma.client.academicYear.findUnique({
      where: { label_semester: { label: dto.label, semester: dto.semester } },
    });
    if (exists) {
      throw new ConflictException(
        `Academic year '${dto.label}' semester ${dto.semester} already exists`,
      );
    }

    // Creating an active term demotes any currently-active one.
    if (dto.isActive) {
      return this.tenantPrisma.client.$transaction(async (tx) => {
        await tx.academicYear.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
        return tx.academicYear.create({
          data: {
            label: dto.label,
            semester: dto.semester,
            startDate: start,
            endDate: end,
            isActive: true,
          },
        });
      });
    }

    return this.tenantPrisma.client.academicYear.create({
      data: {
        label: dto.label,
        semester: dto.semester,
        startDate: start,
        endDate: end,
        isActive: false,
      },
    });
  }

  /** Make this term the single active one; demotes all others. */
  async activate(id: string) {
    await this.findOne(id);
    return this.tenantPrisma.client.$transaction(async (tx) => {
      await tx.academicYear.updateMany({
        where: { isActive: true, NOT: { id } },
        data: { isActive: false },
      });
      return tx.academicYear.update({ where: { id }, data: { isActive: true } });
    });
  }
}

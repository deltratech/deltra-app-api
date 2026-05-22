import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { CreateTimeSlotDto } from './dto/create-time-slot.dto';
import { UpdateTimeSlotDto } from './dto/update-time-slot.dto';
import { paginatedResult } from '../common/utils/paginate';

@Injectable()
export class TimeSlotsService {
  constructor(private readonly tenantPrisma: PrismaTenantService) {}

  async findAll(filters: { page?: number; limit?: number; search?: string } = {}) {
    const { page = 1, limit = 20, search } = filters;
    const skip = (page - 1) * limit;

    const where = {
      ...(search ? { label: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [data, total] = await Promise.all([
      this.tenantPrisma.client.timeSlot.findMany({ where, skip, take: limit, orderBy: { sortOrder: 'asc' } }),
      this.tenantPrisma.client.timeSlot.count({ where }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const slot = await this.tenantPrisma.client.timeSlot.findUnique({ where: { id } });
    if (!slot) throw new NotFoundException(`Time slot ${id} not found`);
    return slot;
  }

  create(dto: CreateTimeSlotDto) {
    return this.tenantPrisma.client.timeSlot.create({ data: dto });
  }

  async update(id: string, dto: UpdateTimeSlotDto) {
    await this.findOne(id);
    return this.tenantPrisma.client.timeSlot.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.tenantPrisma.client.timeSlot.delete({ where: { id } });
  }
}

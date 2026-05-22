import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { paginatedResult } from '../common/utils/paginate';

@Injectable()
export class RoomsService {
  constructor(private readonly tenantPrisma: PrismaTenantService) {}

  async findAll(filters: { page?: number; limit?: number; search?: string } = {}) {
    const { page = 1, limit = 20, search } = filters;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [data, total] = await Promise.all([
      this.tenantPrisma.client.room.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      this.tenantPrisma.client.room.count({ where }),
    ]);

    return paginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const room = await this.tenantPrisma.client.room.findFirst({
      where: { id, deletedAt: null },
    });
    if (!room) throw new NotFoundException(`Room ${id} not found`);
    return room;
  }

  async create(dto: CreateRoomDto) {
    const exists = await this.tenantPrisma.client.room.findFirst({
      where: { name: dto.name, deletedAt: null },
    });
    if (exists) throw new ConflictException(`Room '${dto.name}' already exists`);

    return this.tenantPrisma.client.room.create({ data: dto });
  }

  async update(id: string, dto: UpdateRoomDto) {
    await this.findOne(id);

    if (dto.name) {
      const conflict = await this.tenantPrisma.client.room.findFirst({
        where: { name: dto.name, deletedAt: null, NOT: { id } },
      });
      if (conflict) throw new ConflictException(`Room '${dto.name}' already exists`);
    }

    return this.tenantPrisma.client.room.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.tenantPrisma.client.room.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

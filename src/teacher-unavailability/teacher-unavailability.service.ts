import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';
import { CreateUnavailabilityDto } from './dto/create-unavailability.dto';

@Injectable()
export class TeacherUnavailabilityService {
  constructor(private readonly tenantPrisma: PrismaTenantService) {}

  findAll(teacherProfileId?: string) {
    return this.tenantPrisma.client.teacherUnavailability.findMany({
      where: teacherProfileId ? { teacherProfileId } : {},
      include: {
        teacher:  { select: { id: true, user: { select: { id: true, fullName: true } } } },
        timeSlot: true,
      },
      orderBy: [{ teacherProfileId: 'asc' }, { dayOfWeek: 'asc' }, { timeSlot: { sortOrder: 'asc' } }],
    });
  }

  async findOne(id: string) {
    const u = await this.tenantPrisma.client.teacherUnavailability.findUnique({
      where: { id },
      include: { teacher: true, timeSlot: true },
    });
    if (!u) throw new NotFoundException(`Unavailability record ${id} not found`);
    return u;
  }

  async create(dto: CreateUnavailabilityDto) {
    const exists = await this.tenantPrisma.client.teacherUnavailability.findUnique({
      where: {
        teacherProfileId_dayOfWeek_timeSlotId: {
          teacherProfileId: dto.teacherProfileId,
          dayOfWeek:        dto.dayOfWeek,
          timeSlotId:       dto.timeSlotId,
        },
      },
    });
    if (exists) throw new ConflictException('Unavailability for this teacher/day/slot already exists');

    return this.tenantPrisma.client.teacherUnavailability.create({ data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.tenantPrisma.client.teacherUnavailability.delete({ where: { id } });
  }
}

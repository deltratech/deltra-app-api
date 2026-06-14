import { Injectable } from '@nestjs/common';
import { PrismaTenantService } from '../prisma/prisma-tenant.service';

@Injectable()
export class AcademicYearsService {
  constructor(private readonly tenantPrisma: PrismaTenantService) {}

  findAll(filters: { activeOnly?: boolean } = {}) {
    return this.tenantPrisma.client.academicYear.findMany({
      where: filters.activeOnly ? { isActive: true } : undefined,
      orderBy: [{ label: 'desc' }, { semester: 'asc' }],
    });
  }
}

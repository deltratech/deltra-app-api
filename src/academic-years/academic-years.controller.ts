import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AcademicYearsService } from './academic-years.service';

@ApiTags('Academic Years')
@ApiBearerAuth()
@Controller('academic-years')
export class AcademicYearsController {
  constructor(private readonly service: AcademicYearsService) {}

  @Get()
  @ApiOperation({ summary: 'List academic years (terms)' })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description: 'Return only the active academic year(s)',
  })
  findAll(@Query('activeOnly') activeOnly?: string) {
    return this.service.findAll({ activeOnly: activeOnly === 'true' });
  }
}

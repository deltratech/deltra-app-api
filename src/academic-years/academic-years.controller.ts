import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';

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

  @Post()
  @ApiOperation({ summary: 'Create an academic year (term)' })
  create(@Body() dto: CreateAcademicYearDto) {
    return this.service.create(dto);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Make this term the active one (demotes all others)' })
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.activate(id);
  }
}

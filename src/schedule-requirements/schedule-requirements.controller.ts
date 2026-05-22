import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ScheduleRequirementsService } from './schedule-requirements.service';
import { CreateRequirementDto } from './dto/create-requirement.dto';
import { UpdateRequirementDto } from './dto/update-requirement.dto';

@ApiTags('Schedule Requirements')
@ApiSecurity('x-api-key')
@Controller('schedule-requirements')
export class ScheduleRequirementsController {
  constructor(private readonly service: ScheduleRequirementsService) {}

  @Get()
  @ApiOperation({ summary: 'List requirements (auto-scheduler inputs)' })
  @ApiQuery({ name: 'academicYear', required: false })
  @ApiQuery({ name: 'semester',     required: false, type: Number })
  @ApiQuery({ name: 'classroomId',  required: false })
  findAll(
    @Query('academicYear')  academicYear?: string,
    @Query('classroomId')   classroomId?: string,
    @Query('semester', new ParseIntPipe({ optional: true })) semester?: number,
  ) {
    return this.service.findAll({ academicYear, semester, classroomId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a requirement by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a schedule requirement' })
  create(@Body() dto: CreateRequirementDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update sessions-per-week, teacher, or room' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRequirementDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a requirement' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}

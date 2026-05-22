import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { DayOfWeek } from '../common/enums/day-of-week.enum';
import { ScheduleStatus } from '../common/enums/schedule-status.enum';

@ApiTags('Schedules')
@ApiSecurity('x-api-key')
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly service: SchedulesService) {}

  @Get()
  @ApiOperation({ summary: 'List schedules with optional filters' })
  @ApiQuery({ name: 'classroomId',      required: false })
  @ApiQuery({ name: 'teacherProfileId', required: false })
  @ApiQuery({ name: 'academicYear',     required: false })
  @ApiQuery({ name: 'semester',         required: false, type: Number })
  @ApiQuery({ name: 'dayOfWeek',        required: false, enum: DayOfWeek })
  @ApiQuery({ name: 'status',           required: false, enum: ScheduleStatus })
  @ApiQuery({ name: 'search',           required: false, description: 'Search by classroom or subject name' })
  @ApiQuery({ name: 'page',             required: false, type: Number })
  @ApiQuery({ name: 'limit',            required: false, type: Number })
  findAll(
    @Query('classroomId')      classroomId?:      string,
    @Query('teacherProfileId') teacherProfileId?: string,
    @Query('academicYear')     academicYear?:     string,
    @Query('dayOfWeek')        dayOfWeek?:        DayOfWeek,
    @Query('status')           status?:           ScheduleStatus,
    @Query('search')           search?:           string,
    @Query('semester', new ParseIntPipe({ optional: true })) semester?: number,
    @Query('page',     new ParseIntPipe({ optional: true })) page?:     number,
    @Query('limit',    new ParseIntPipe({ optional: true })) limit?:    number,
  ) {
    return this.service.findAll({ classroomId, teacherProfileId, academicYear, semester, dayOfWeek, status, search, page, limit });
  }

  @Get('by-class/:classroomId')
  @ApiOperation({ summary: 'Get active schedules for a class' })
  @ApiQuery({ name: 'academicYear', required: false })
  @ApiQuery({ name: 'semester',     required: false, type: Number })
  findByClass(
    @Param('classroomId', ParseUUIDPipe) classroomId: string,
    @Query('academicYear') academicYear?: string,
    @Query('semester', new ParseIntPipe({ optional: true })) semester?: number,
  ) {
    return this.service.findByClass(classroomId, academicYear, semester);
  }

  @Get('by-teacher/:teacherProfileId')
  @ApiOperation({ summary: 'Get active schedules for a teacher' })
  @ApiQuery({ name: 'academicYear', required: false })
  @ApiQuery({ name: 'semester',     required: false, type: Number })
  findByTeacher(
    @Param('teacherProfileId', ParseUUIDPipe) teacherProfileId: string,
    @Query('academicYear') academicYear?: string,
    @Query('semester', new ParseIntPipe({ optional: true })) semester?: number,
  ) {
    return this.service.findByTeacher(teacherProfileId, academicYear, semester);
  }

  @Get('by-student/:studentProfileId')
  @ApiOperation({ summary: 'Get active schedules for a student (via enrollment)' })
  @ApiQuery({ name: 'academicYear', required: false })
  @ApiQuery({ name: 'semester',     required: false, type: Number })
  findByStudent(
    @Param('studentProfileId', ParseUUIDPipe) studentProfileId: string,
    @Query('academicYear') academicYear?: string,
    @Query('semester', new ParseIntPipe({ optional: true })) semester?: number,
  ) {
    return this.service.findByStudent(studentProfileId, academicYear, semester);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a schedule by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a schedule (validates teacher, class, and room conflicts)' })
  create(@Body() dto: CreateScheduleDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a schedule (re-validates conflicts)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete and archive a schedule' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}

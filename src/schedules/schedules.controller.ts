import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleStatus } from '../common/enums/schedule-status.enum';
import { CreateScheduleEntryDto } from './dto/create-schedule-entry.dto';
import { UpdateScheduleEntryDto } from './dto/update-schedule-entry.dto';
import { CreatePeriodTemplateDto } from './dto/create-period-template.dto';
import { UpdatePeriodTemplateDto } from './dto/update-period-template.dto';
import { CreatePeriodRowDto } from './dto/create-period-row.dto';
import { UpdatePeriodRowDto } from './dto/update-period-row.dto';

type CurrentUserContext = { userId: string; role?: string };

@ApiTags('Schedules')
@ApiBearerAuth()
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly service: SchedulesService) {}

  @Get()
  @ApiOperation({ summary: 'List schedule documents with entries' })
  @ApiQuery({ name: 'classroomId', required: false })
  @ApiQuery({ name: 'academicYearId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ScheduleStatus })
  @ApiQuery({ name: 'search', required: false, description: 'Search by classroom name' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('classroomId') classroomId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('status') status?: ScheduleStatus,
    @Query('search') search?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.service.findAll({ classroomId, academicYearId, status, search, page, limit });
  }

  @Get('period-templates')
  @ApiOperation({ summary: 'List period templates with derived start/end times' })
  listPeriodTemplates() {
    return this.service.listPeriodTemplates();
  }

  @Post('period-templates')
  @ApiOperation({ summary: 'Create a period template for a grade and academic year' })
  createPeriodTemplate(@Body() dto: CreatePeriodTemplateDto) {
    return this.service.createPeriodTemplate(dto);
  }

  @Patch('period-templates/:id')
  @ApiOperation({ summary: 'Update a period template' })
  updatePeriodTemplate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePeriodTemplateDto) {
    return this.service.updatePeriodTemplate(id, dto);
  }

  @Post('period-templates/:templateId/rows')
  @ApiOperation({ summary: 'Add a period row to a template' })
  addPeriodRow(@Param('templateId', ParseUUIDPipe) templateId: string, @Body() dto: CreatePeriodRowDto) {
    return this.service.addPeriodRow(templateId, dto);
  }

  @Patch('period-rows/:id')
  @ApiOperation({ summary: 'Update a period row' })
  updatePeriodRow(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePeriodRowDto) {
    return this.service.updatePeriodRow(id, dto);
  }

  @Delete('period-rows/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a period row' })
  removePeriodRow(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removePeriodRow(id);
  }

  @Get('by-class/:classroomId')
  @ApiOperation({ summary: 'Get schedule documents for a class' })
  @ApiQuery({ name: 'academicYearId', required: false })
  findByClass(
    @Param('classroomId', ParseUUIDPipe) classroomId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.findByClass(classroomId, academicYearId);
  }

  @Get('by-teacher/:teacherProfileId')
  @ApiOperation({ summary: 'Get schedule documents containing a teacher' })
  @ApiQuery({ name: 'academicYearId', required: false })
  findByTeacher(
    @Param('teacherProfileId', ParseUUIDPipe) teacherProfileId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.findByTeacher(teacherProfileId, academicYearId);
  }

  @Get('by-student/:studentProfileId')
  @ApiOperation({ summary: 'Get schedule documents for a student via active enrollment' })
  @ApiQuery({ name: 'academicYearId', required: false })
  findByStudent(
    @Param('studentProfileId', ParseUUIDPipe) studentProfileId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.findByStudent(studentProfileId, academicYearId);
  }

  @Get('student/me')
  @ApiOperation({ summary: 'Get published schedule documents for the current student' })
  @ApiQuery({ name: 'academicYearId', required: false })
  findMyStudentSchedules(
    @CurrentUser() user: CurrentUserContext,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.findForCurrentStudent(user, academicYearId);
  }

  @Get('parent')
  @ApiOperation({ summary: 'Get published schedule documents for the current parent linked students' })
  @ApiQuery({ name: 'studentProfileId', required: false })
  @ApiQuery({ name: 'academicYearId', required: false })
  findParentSchedules(
    @CurrentUser() user: CurrentUserContext,
    @Query('studentProfileId') studentProfileId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.findForParent(user, { studentProfileId, academicYearId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a schedule document by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a schedule document for a class and term' })
  create(@Body() dto: CreateScheduleDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a schedule document' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateScheduleDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/publish')
  @ApiOperation({ summary: 'Publish a schedule document' })
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.publish(id);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive a schedule document' })
  archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.archive(id);
  }

  @Post(':id/entries')
  @ApiOperation({ summary: 'Add a placed block or tray item to a schedule' })
  addEntry(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateScheduleEntryDto) {
    return this.service.addEntry(id, dto);
  }

  @Patch(':id/entries/:entryId')
  @ApiOperation({ summary: 'Update a schedule entry' })
  updateEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() dto: UpdateScheduleEntryDto,
  ) {
    return this.service.updateEntry(id, entryId, dto);
  }

  @Delete(':id/entries/:entryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a schedule entry' })
  removeEntry(@Param('id', ParseUUIDPipe) id: string, @Param('entryId', ParseUUIDPipe) entryId: string) {
    return this.service.removeEntry(id, entryId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive a schedule document' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}

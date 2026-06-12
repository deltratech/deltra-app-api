import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance-query.dto';
import { FindGradeAttendanceSummaryQueryDto } from './dto/find-grade-attendance-summary-query.dto';
import { FindHomeroomAttendanceQueryDto } from './dto/find-homeroom-attendance-query.dto';
import { FindStudentAttendanceQueryDto } from './dto/find-my-attendance-query.dto';
import { AttendanceAggregatePeriod, FindParentAttendanceQueryDto } from './dto/find-parent-attendance-query.dto';
import { FindSubjectAttendanceQueryDto } from './dto/find-subject-attendance-query.dto';

type CurrentUserContext = { userId: string; role?: string };

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller()
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Post('attendance')
  @ApiOperation({ summary: 'Create or update attendance records for students' })
  createAttendance(
    @CurrentUser() user: CurrentUserContext,
    @Body() dto: CreateAttendanceDto,
  ) {
    return this.service.createAttendance(user, dto);
  }

  @Get('attendance/homeroom')
  @ApiOperation({ summary: 'Get homeroom attendance for the current homeroom teacher' })
  @ApiQuery({ name: 'classroomId', required: false })
  @ApiQuery({ name: 'academicYearId', required: false })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'weekStart', required: false })
  findHomeroomAttendance(
    @CurrentUser() user: CurrentUserContext,
    @Query() query: FindHomeroomAttendanceQueryDto,
  ) {
    return this.service.findHomeroomAttendance(user, query);
  }

  @Get('attendance/subject')
  @ApiOperation({ summary: 'Get subject attendance for the current subject teacher' })
  @ApiQuery({ name: 'scheduleEntryId', required: false })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiQuery({ name: 'classroomId', required: false })
  @ApiQuery({ name: 'academicYearId', required: false })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'weekStart', required: false })
  findSubjectAttendance(
    @CurrentUser() user: CurrentUserContext,
    @Query() query: FindSubjectAttendanceQueryDto,
  ) {
    return this.service.findSubjectAttendance(user, query);
  }

  @Get('attendance/summary/grades')
  @ApiOperation({ summary: 'Get attendance summary grouped by grade for principal and school admin' })
  @ApiQuery({ name: 'academicYearId', required: false })
  @ApiQuery({ name: 'classroomId', required: false })
  @ApiQuery({ name: 'gradeLevel', required: false, type: Number })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'weekStart', required: false })
  findGradeSummary(
    @CurrentUser() user: CurrentUserContext,
    @Query() query: FindGradeAttendanceSummaryQueryDto,
  ) {
    return this.service.findGradeSummary(user, query);
  }

  @Get('attendance/parent')
  @ApiOperation({ summary: 'Get parent view of linked student attendance with daily, weekly, monthly, or termly aggregation' })
  @ApiQuery({ name: 'studentProfileId', required: false })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiQuery({ name: 'academicYearId', required: false })
  @ApiQuery({ name: 'period', enum: AttendanceAggregatePeriod, required: false })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'month', required: false, example: '2026-06' })
  findParentAttendance(
    @CurrentUser() user: CurrentUserContext,
    @Query() query: FindParentAttendanceQueryDto,
  ) {
    return this.service.findParentAttendance(user, query);
  }

  @Get('student/attendance/:studentId')
  @ApiOperation({ summary: 'Get student attendance, optionally filtered by subject or academic year' })
  @ApiParam({ name: 'studentId', description: 'Student profile ID or student user ID' })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiQuery({ name: 'academicYearId', required: false })
  findStudentAttendance(
    @CurrentUser() user: CurrentUserContext,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Query() query: FindStudentAttendanceQueryDto,
  ) {
    return this.service.findStudentAttendance(user, studentId, query);
  }
}

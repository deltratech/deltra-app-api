import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Post, Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { TeacherUnavailabilityService } from './teacher-unavailability.service';
import { CreateUnavailabilityDto } from './dto/create-unavailability.dto';

@ApiTags('Teacher Unavailability')
@ApiSecurity('x-api-key')
@Controller('teacher-unavailability')
export class TeacherUnavailabilityController {
  constructor(private readonly service: TeacherUnavailabilityService) {}

  @Get()
  @ApiOperation({ summary: 'List unavailability records (optionally filter by teacher)' })
  @ApiQuery({ name: 'teacherProfileId', required: false })
  findAll(@Query('teacherProfileId') teacherProfileId?: string) {
    return this.service.findAll(teacherProfileId);
  }

  @Post()
  @ApiOperation({ summary: 'Mark a time slot as unavailable for a teacher' })
  create(@Body() dto: CreateUnavailabilityDto) {
    return this.service.create(dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an unavailability record' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}

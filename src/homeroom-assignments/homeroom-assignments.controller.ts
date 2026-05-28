import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { HomeroomAssignmentsService } from './homeroom-assignments.service';
import { CreateHomeroomAssignmentDto } from './dto/create-homeroom-assignment.dto';
import { UpdateHomeroomAssignmentDto } from './dto/update-homeroom-assignment.dto';

@ApiTags('Homeroom Assignments')
@ApiBearerAuth()
@Controller('homeroom-assignments')
export class HomeroomAssignmentsController {
  constructor(private readonly service: HomeroomAssignmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List homeroom teacher assignments' })
  @ApiQuery({ name: 'classroomId', required: false })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('classroomId') classroomId?: string,
    @Query('active', new ParseBoolPipe({ optional: true })) active?: boolean,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.service.findAll({ classroomId, active, page, limit });
  }

  @Get('classrooms/:classroomId')
  @ApiOperation({ summary: 'Get classroom detail with assigned homeroom teacher and history' })
  getClassroomDetail(@Param('classroomId', ParseUUIDPipe) classroomId: string) {
    return this.service.getClassroomDetail(classroomId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get homeroom teacher assignment by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Assign a homeroom teacher to a classroom' })
  create(@Body() dto: CreateHomeroomAssignmentDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a homeroom teacher assignment record' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateHomeroomAssignmentDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'End an active homeroom teacher assignment' })
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivate(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a homeroom teacher assignment' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}

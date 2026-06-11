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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ClassroomsService } from './classrooms.service';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { UpdateClassroomDto } from './dto/update-classroom.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AssignClassroomDto } from './dto/assign-classroom.dto';
import { UnassignClassroomDto } from './dto/unassign-classroom.dto';
import { AssignMultipleStudentClassroomDto } from './dto/assign-multiple-student-classroom.dto';
import { UserRole } from '../common/enums/user-role.enum';

type CurrentUserContext = { userId: string; role?: UserRole };

@ApiTags('Classrooms')
@ApiBearerAuth()
@Controller('classrooms')
export class ClassroomsController {
  constructor(private readonly service: ClassroomsService) {}

  @Get()
  @ApiOperation({ summary: 'List all classrooms/classes' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by class name',
  })
  @ApiQuery({ name: 'academicYearId', required: false })
  @ApiQuery({ name: 'gradeLevel', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('search') search?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('gradeLevel', new ParseIntPipe({ optional: true }))
    gradeLevel?: number,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.service.findAll({
      search,
      academicYearId,
      gradeLevel,
      page,
      limit,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a classroom/class by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a classroom/class' })
  create(@Body() dto: CreateClassroomDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a classroom/class' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassroomDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a classroom/class' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  // assign multiple students to classroom
  @Post(':classroomId/assign-multiple-students')
  @ApiOperation({ summary: 'Assign multiple students to a classroom' })
  assignMultipleStudents(
    @CurrentUser() user: CurrentUserContext,
    @Param('classroomId', ParseUUIDPipe) id: string,
    @Body() dto: AssignMultipleStudentClassroomDto,
  ) {
    return this.service.assignMultipleStudents(user, id, dto);
  }

  // assign a student to classroom
  @Post(':classroomId/assign-student')
  @ApiOperation({ summary: 'Assign a student to a classroom' })
  assignStudent(
    @CurrentUser() user: CurrentUserContext,
    @Param('classroomId', ParseUUIDPipe) id: string,
    @Body() dto: AssignClassroomDto,
  ) {
    return this.service.assignStudent(user, id, dto);
  }

  // unassign a student from classroom
  @Post(':classroomId/unassign-student')
  @ApiOperation({ summary: 'Unassign a student from a classroom' })
  unassignStudent(
    @CurrentUser() user: CurrentUserContext,
    @Param('classroomId', ParseUUIDPipe) id: string,
    @Body() dto: UnassignClassroomDto,
  ) {
    return this.service.unassignStudent(user, id, dto);
  }
}

import {
  BadRequestException,
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AcademicNotesService } from './academic-notes.service';
import { CreateAcademicNoteDto } from './dto/create-academic-note.dto';
import { UpdateAcademicNoteDto } from './dto/update-academic-note.dto';

type CurrentUserContext = { userId: string; role?: string; tenantSlug?: string };

@ApiTags('Academic Notes')
@ApiBearerAuth()
@Controller('academic-notes')
export class AcademicNotesController {
  constructor(private readonly service: AcademicNotesService) {}

  @Get()
  @ApiOperation({ summary: 'List academic notes with role-aware visibility' })
  @ApiQuery({ name: 'studentProfileId', required: false })
  @ApiQuery({ name: 'teacherProfileId', required: false })
  @ApiQuery({ name: 'classroomId', required: false })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, description: 'Search by title or body' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @CurrentUser() user: CurrentUserContext,
    @Query('studentProfileId') studentProfileId?: string,
    @Query('teacherProfileId') teacherProfileId?: string,
    @Query('classroomId') classroomId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('year', new ParseIntPipe({ optional: true })) year?: number,
    @Query('search') search?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.service.findAll({ studentProfileId, teacherProfileId, classroomId, subjectId, year, search, page, limit }, user);
  }

  @Get('mine')
  @ApiOperation({ summary: 'List academic notes for the current student or linked parent account' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findMine(
    @CurrentUser() user: CurrentUserContext,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.service.findMine(user, { page, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an academic note by ID' })
  findOne(@CurrentUser() user: CurrentUserContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id, user);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        studentProfileIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
        title: { type: 'string' },
        body: { type: 'string' },
        subjectId: { type: 'string', format: 'uuid' },
        classroomId: { type: 'string', format: 'uuid' },
        noteDate: { type: 'string', format: 'date' },
        visibleToGuardian: { type: 'boolean', default: true },
        file: { type: 'string', format: 'binary' },
      },
      required: ['studentProfileIds', 'title', 'body'],
    },
  })
  @ApiOperation({ summary: 'Create academic notes for one or more students, optionally with one file' })
  create(
    @CurrentUser() user: CurrentUserContext,
    @Body() dto: CreateAcademicNoteDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.create(dto, user, file);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an academic note' })
  update(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAcademicNoteDto,
  ) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/file')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } })
  @ApiOperation({ summary: 'Upload or replace the academic note file' })
  updateFile(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.service.updateFile(id, file, user);
  }

  @Delete(':id/file')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove the academic note file' })
  removeFile(@CurrentUser() user: CurrentUserContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeFile(id, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an academic note' })
  remove(@CurrentUser() user: CurrentUserContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id, user);
  }
}

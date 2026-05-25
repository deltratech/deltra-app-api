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
import { StudentAchievementsService } from './student-achievements.service';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { UpdateAchievementDto } from './dto/update-achievement.dto';
import { AchievementCategory } from '../common/enums/achievement-category.enum';
import { AchievementLevel } from '../common/enums/achievement-level.enum';

@ApiTags('Student Achievements')
@ApiBearerAuth()
@Controller('student-achievements')
export class StudentAchievementsController {
  constructor(private readonly service: StudentAchievementsService) {}

  @Get()
  @ApiOperation({ summary: 'List achievements with optional filters' })
  @ApiQuery({ name: 'studentProfileId', required: false })
  @ApiQuery({ name: 'category',         required: false, enum: AchievementCategory })
  @ApiQuery({ name: 'level',            required: false, enum: AchievementLevel })
  @ApiQuery({ name: 'year',             required: false, type: Number })
  @ApiQuery({ name: 'classroomId',      required: false })
  @ApiQuery({ name: 'search',           required: false, description: 'Search by title, event name, or organizer' })
  @ApiQuery({ name: 'page',             required: false, type: Number })
  @ApiQuery({ name: 'limit',            required: false, type: Number })
  findAll(
    @Query('studentProfileId') studentProfileId?: string,
    @Query('category')         category?: AchievementCategory,
    @Query('level')            level?: AchievementLevel,
    @Query('year',  new ParseIntPipe({ optional: true })) year?: number,
    @Query('classroomId')      classroomId?: string,
    @Query('search')           search?: string,
    @Query('page',  new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.service.findAll({ studentProfileId, category, level, year, classroomId, search, page, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an achievement by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Record a new achievement' })
  create(@Body() dto: CreateAchievementDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an achievement' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAchievementDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an achievement and its attachments' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  // ── Attachments ───────────────────────────────────────────────────────────────

  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Upload a certificate or supporting document (JPEG/PNG/WebP/PDF ≤ 10 MB)' })
  addAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { tenantSlug: string },
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.service.addAttachment(id, file, user.tenantSlug);
  }

  @Delete(':id/attachments/:attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an attachment from an achievement' })
  removeAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.service.removeAttachment(id, attachmentId);
  }
}

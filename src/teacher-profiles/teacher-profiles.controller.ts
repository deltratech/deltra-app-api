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
import { TeacherProfilesService } from './teacher-profiles.service';
import { CreateTeacherProfileDto } from './dto/create-teacher-profile.dto';
import { UpdateTeacherProfileDto } from './dto/update-teacher-profile.dto';
import { TeacherStatus } from '../common/enums/teacher-status.enum';

@ApiTags('Teacher Profiles')
@ApiBearerAuth()
@Controller('teacher-profiles')
export class TeacherProfilesController {
  constructor(private readonly service: TeacherProfilesService) {}

  @Get()
  @ApiOperation({ summary: 'List all teacher profiles in this tenant' })
  @ApiQuery({ name: 'status', enum: TeacherStatus, required: false })
  @ApiQuery({ name: 'search', required: false, description: 'Search by full name, NUPTK, or NIK' })
  @ApiQuery({ name: 'page',   required: false, type: Number })
  @ApiQuery({ name: 'limit',  required: false, type: Number })
  findAll(
    @Query('status') status?: TeacherStatus,
    @Query('search') search?: string,
    @Query('page',  new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.service.findAll({ status, search, page, limit });
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get a teacher profile by user ID' })
  findByUserId(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.service.findByUserId(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a teacher profile by profile ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a teacher profile' })
  create(@Body() dto: CreateTeacherProfileDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a teacher profile' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeacherProfileDto,
  ) {
    return this.service.update(id, dto);
  }

  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { photo: { type: 'string', format: 'binary' } },
      required: ['photo'],
    },
  })
  @ApiOperation({ summary: 'Upload or replace a teacher profile photo' })
  uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { tenantSlug: string },
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype))
      throw new BadRequestException('Only JPEG, PNG, or WebP images are accepted');
    if (file.size > 5 * 1024 * 1024)
      throw new BadRequestException('Image must be under 5 MB');

    return this.service.updatePhoto(id, file, user.tenantSlug);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a teacher profile' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}

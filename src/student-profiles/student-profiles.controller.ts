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
import { ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StudentProfilesService } from './student-profiles.service';
import { CreateStudentProfileDto } from './dto/create-student-profile.dto';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';
import { StudentStatus } from '../common/enums/student-status.enum';

@ApiTags('Student Profiles')
@ApiSecurity('x-api-key')
@Controller('student-profiles')
export class StudentProfilesController {
  constructor(private readonly service: StudentProfilesService) {}

  @Get()
  @ApiOperation({ summary: 'List all student profiles' })
  @ApiQuery({ name: 'status', enum: StudentStatus, required: false })
  @ApiQuery({ name: 'search', required: false, description: 'Search by full name or NISN' })
  @ApiQuery({ name: 'page',   required: false, type: Number })
  @ApiQuery({ name: 'limit',  required: false, type: Number })
  findAll(
    @Query('status') status?: StudentStatus,
    @Query('search') search?: string,
    @Query('page',  new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.service.findAll({ status, search, page, limit });
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get a student profile by user ID' })
  findByUserId(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.service.findByUserId(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a student profile by profile ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a student profile' })
  create(@Body() dto: CreateStudentProfileDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a student profile' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentProfileDto,
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
  @ApiOperation({ summary: 'Upload or replace a student profile photo' })
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
  @ApiOperation({ summary: 'Delete a student profile' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  // ── Guardians ────────────────────────────────────────────────────────────────

  @Post(':id/guardians')
  @ApiOperation({ summary: 'Add a guardian to a student' })
  addGuardian(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateGuardianDto,
  ) {
    return this.service.addGuardian(id, dto);
  }

  @Patch(':id/guardians/:guardianId')
  @ApiOperation({ summary: 'Update a guardian' })
  updateGuardian(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('guardianId', ParseUUIDPipe) guardianId: string,
    @Body() dto: UpdateGuardianDto,
  ) {
    return this.service.updateGuardian(id, guardianId, dto);
  }

  @Delete(':id/guardians/:guardianId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a guardian from a student' })
  removeGuardian(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('guardianId', ParseUUIDPipe) guardianId: string,
  ) {
    return this.service.removeGuardian(id, guardianId);
  }
}

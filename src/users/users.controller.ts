import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UsersImportService, ImportResult } from './users.import.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateRolesDto } from './dto/update-roles.dto';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Users')
@ApiSecurity('x-api-key')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly importService: UsersImportService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all users' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by full name, email, or username' })
  @ApiQuery({ name: 'role',   required: false })
  @ApiQuery({ name: 'page',   required: false, type: Number })
  @ApiQuery({ name: 'limit',  required: false, type: Number })
  findAll(
    @Query('search') search?: string,
    @Query('role')   role?: string,
    @Query('page',  new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.usersService.findAll({ search, role, page, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a user' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a user' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }

  @Post('me/photo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('photo'))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { photo: { type: 'string', format: 'binary' } }, required: ['photo'] } })
  @ApiOperation({ summary: 'Upload or replace the current user\'s avatar photo' })
  uploadMyPhoto(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { userId: string; tenantSlug: string },
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    this.validateImageFile(file);
    return this.usersService.updateAvatar(user.userId, file, user.tenantSlug);
  }

  @Patch('bulk/roles')
  @ApiOperation({ summary: 'Update roles for multiple users at once' })
  bulkUpdateRoles(@Body() dto: UpdateRolesDto) {
    return this.usersService.bulkUpdateRoles(dto);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        role: { type: 'string', enum: Object.values(UserRole), description: 'Filter: only import rows with this role' },
      },
      required: ['file'],
    },
  })
  @ApiQuery({ name: 'role', enum: UserRole, required: false, description: 'Only import rows with this role' })
  @ApiOperation({ summary: 'Import users from Excel (.xlsx) or CSV file' })
  async importUsers(
    @UploadedFile() file: Express.Multer.File,
    @Query('role') role?: UserRole,
  ): Promise<ImportResult> {
    if (!file) throw new BadRequestException('No file uploaded');

    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
    ];
    if (!allowed.some(t => file.mimetype.includes(t.split('/')[1]))) {
      throw new BadRequestException('Only .xlsx or .csv files are accepted');
    }

    return this.importService.importFromFile(file.buffer, file.mimetype, role);
  }

  private validateImageFile(file: Express.Multer.File) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype))
      throw new BadRequestException('Only JPEG, PNG, or WebP images are accepted');
    if (file.size > 5 * 1024 * 1024)
      throw new BadRequestException('Image must be under 5 MB');
  }
}

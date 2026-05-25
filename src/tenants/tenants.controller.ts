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
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { UpsertTenantSettingsDto } from './dto/upsert-tenant-settings.dto';
import { Public } from '../common/decorators/public.decorator';
import { ValidateTenantSlugDto } from './dto/validate-tenant-slug.dto';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  // ── Public ──────────────────────────────────────────────────────────────────

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new tenant (public — no API key required)' })
  register(@Body() dto: RegisterTenantDto) {
    return this.tenantsService.register(dto);
  }

  @Public()
  @Get('validate-slug')
  @ApiOperation({ summary: 'Validate whether a tenant slug is available' })
  @ApiQuery({ name: 'slug', required: true, description: 'Slug to validate' })
  validateSlug(@Query() query: ValidateTenantSlugDto) {
    return this.tenantsService.validateSlug(query.slug);
  }

  // ── Tenants ─────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all tenants' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name or slug' })
  @ApiQuery({ name: 'page',   required: false, type: Number })
  @ApiQuery({ name: 'limit',  required: false, type: Number })
  findAll(
    @Query('search') search?: string,
    @Query('page',  new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.tenantsService.findAll({ search, page, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a tenant by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a tenant and provision its schema' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a tenant' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a tenant' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.remove(id);
  }

  // ── Migrations ──────────────────────────────────────────────────────────────

  @Post('migrate-all')
  @ApiOperation({
    summary: 'Apply pending migrations to ALL tenant schemas',
    description:
      'Safe to run at any time — migrate deploy is idempotent. ' +
      'Schemas created with db push are auto-baselined before migrating.',
  })
  migrateAll() {
    return this.tenantsService.migrateAll();
  }

  @Post(':id/migrate')
  @ApiOperation({ summary: 'Apply pending migrations to a single tenant schema' })
  migrateTenant(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.migrateTenant(id);
  }

  // ── Tenant Settings ──────────────────────────────────────────────────────────

  @Get(':id/settings')
  @ApiOperation({ summary: 'Get settings for a tenant' })
  getSettings(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.getSettings(id);
  }

  @Put(':id/settings')
  @ApiOperation({ summary: 'Create or update settings for a tenant' })
  upsertSettings(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertTenantSettingsDto,
  ) {
    return this.tenantsService.upsertSettings(id, dto);
  }

  @Delete(':id/settings')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete settings for a tenant' })
  deleteSettings(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.deleteSettings(id);
  }
}

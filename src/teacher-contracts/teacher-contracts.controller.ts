import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateContractTemplateDto } from './dto/create-contract-template.dto';
import { CreateTeacherContractDto, TeacherContractStatus, TeacherContractTemplateType } from './dto/create-teacher-contract.dto';
import { PreviewTeacherContractDto } from './dto/preview-teacher-contract.dto';
import { UpdateContractTemplateDto } from './dto/update-contract-template.dto';
import { UpdateTeacherContractDto } from './dto/update-teacher-contract.dto';
import { TeacherContractsService } from './teacher-contracts.service';

@ApiTags('Teacher Contracts')
@ApiBearerAuth()
@Controller('teacher-contracts')
export class TeacherContractsController {
  constructor(private readonly teacherContractsService: TeacherContractsService) {}

  @Post('templates')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        name: { type: 'string' },
        templateType: { type: 'string', enum: ['guru_tetap', 'guru_honorer', 'staff'] },
        body: { type: 'string' },
        version: { type: 'number' },
        isActive: { type: 'boolean' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['code', 'name', 'templateType', 'file'],
    },
  })
  @ApiOperation({ summary: 'Create teacher/staff contract template' })
  createTemplate(@Body() dto: CreateContractTemplateDto, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No template file uploaded');
    this.validateDocxTemplateFile(file);
    return this.teacherContractsService.createTemplate(dto, file);
  }

  @Get('templates')
  @ApiOperation({ summary: 'List contract templates' })
  @ApiQuery({ name: 'templateType', enum: TeacherContractTemplateType, required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  findTemplates(
    @Query('templateType') templateType?: TeacherContractTemplateType,
    @Query('isActive') isActive?: string,
  ) {
    return this.teacherContractsService.findTemplates({
      templateType,
      isActive: isActive === undefined ? undefined : isActive === 'true',
    });
  }

  @Patch('templates/:id')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        templateType: { type: 'string', enum: ['guru_tetap', 'guru_honorer', 'staff'] },
        body: { type: 'string' },
        version: { type: 'number' },
        isActive: { type: 'boolean' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Update contract template' })
  updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractTemplateDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) this.validateDocxTemplateFile(file);
    return this.teacherContractsService.updateTemplate(id, dto, file);
  }

  @Post('preview')
  @ApiOperation({ summary: 'Preview generated contract before finalization' })
  preview(@Body() dto: PreviewTeacherContractDto) {
    return this.teacherContractsService.preview(dto);
  }

  @Post()
  @ApiOperation({ summary: 'Finalize and create generated teacher contract' })
  create(
    @Body() dto: CreateTeacherContractDto,
    @CurrentUser() user: { userId: string; tenantSlug?: string; isSuperAdmin?: boolean },
  ) {
    return this.teacherContractsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve contracts by staff, type, status, and period' })
  @ApiQuery({ name: 'teacherProfileId', required: false })
  @ApiQuery({ name: 'templateType', enum: TeacherContractTemplateType, required: false })
  @ApiQuery({ name: 'status', enum: TeacherContractStatus, required: false })
  @ApiQuery({ name: 'periodStart', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'periodEnd', required: false, description: 'YYYY-MM-DD' })
  findAll(
    @Query('teacherProfileId') teacherProfileId?: string,
    @Query('templateType') templateType?: TeacherContractTemplateType,
    @Query('status') status?: TeacherContractStatus,
    @Query('periodStart') periodStart?: string,
    @Query('periodEnd') periodEnd?: string,
  ) {
    return this.teacherContractsService.findAll({
      teacherProfileId,
      templateType,
      status,
      periodStart,
      periodEnd,
    });
  }

  @Get('renewal-reminders')
  @ApiOperation({ summary: 'List contracts approaching renewal' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  renewalReminders(@Query('days') days?: string) {
    return this.teacherContractsService.findRenewalReminders(days ? Number(days) : 30);
  }

  @Get('my')
  @ApiOperation({ summary: 'Teacher self-view contracts' })
  myContracts(@CurrentUser() user: { userId: string; tenantSlug?: string; isSuperAdmin?: boolean }) {
    return this.teacherContractsService.findMyContracts(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get teacher contract by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.teacherContractsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit generated contract before/after PDF generation' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeacherContractDto,
    @CurrentUser() user: { userId: string; tenantSlug?: string; isSuperAdmin?: boolean },
  ) {
    return this.teacherContractsService.update(id, dto, user);
  }

  @Patch(':id/pdf')
  @ApiOperation({ summary: 'Attach generated PDF URL for contract' })
  setPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { pdfUrl: string },
    @CurrentUser() user: { userId: string; tenantSlug?: string; isSuperAdmin?: boolean },
  ) {
    return this.teacherContractsService.setPdfUrl(id, body.pdfUrl, user);
  }

  @Patch(':id/publish')
  @ApiOperation({ summary: 'Publish contract and send to pending signature' })
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { userId: string; tenantSlug?: string; isSuperAdmin?: boolean },
  ) {
    return this.teacherContractsService.publish(id, user);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Teacher approves and signs contract' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { eSignature: string },
    @CurrentUser() user: { userId: string; tenantSlug?: string; isSuperAdmin?: boolean },
  ) {
    return this.teacherContractsService.approve(id, body.eSignature, user);
  }

  private validateDocxTemplateFile(file: Express.Multer.File) {
    const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (file.mimetype !== mime) {
      throw new BadRequestException('Only DOCX template files are accepted');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Template file must be under 10 MB');
    }
  }
}

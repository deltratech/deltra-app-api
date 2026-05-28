import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateContractTemplateDto } from './dto/create-contract-template.dto';
import { CreateTeacherContractDto, TeacherContractStatus, TeacherContractTemplateType } from './dto/create-teacher-contract.dto';
import { CreateUploadedTeacherContractDto } from './dto/create-uploaded-teacher-contract.dto';
import { PreviewTeacherContractDto } from './dto/preview-teacher-contract.dto';
import { UpdateContractTemplateDto } from './dto/update-contract-template.dto';
import { UpdateTeacherContractReminderDto } from './dto/update-teacher-contract-reminder.dto';
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
        name: { type: 'string' },
        templateType: { type: 'string', enum: ['guru_tetap', 'guru_honorer', 'staff'] },
        version: { type: 'number' },
        isActive: { type: 'boolean' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['name', 'templateType', 'file'],
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

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get contract template detail including extracted variables' })
  findTemplateOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.teacherContractsService.findTemplateOne(id);
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

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Soft-delete contract template' })
  removeTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return this.teacherContractsService.removeTemplate(id);
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

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        teacherProfileId: { type: 'string', format: 'uuid' },
        templateType: { type: 'string', enum: ['guru_tetap', 'guru_honorer', 'staff'] },
        contractStartDate: { type: 'string', format: 'date' },
        contractEndDate: { type: 'string', format: 'date' },
        employmentStatus: { type: 'string', enum: ['pns', 'p3k', 'tetap', 'honorer'] },
        documentTitle: { type: 'string' },
        eSignature: { type: 'string' },
        signedAt: { type: 'string', format: 'date' },
        notes: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['teacherProfileId', 'contractStartDate', 'contractEndDate', 'file'],
    },
  })
  @ApiOperation({ summary: 'Create teacher contract by direct file upload (without template)' })
  createByUpload(
    @Body() dto: CreateUploadedTeacherContractDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { userId: string; tenantSlug?: string; isSuperAdmin?: boolean },
  ) {
    if (!file) throw new BadRequestException('No contract file uploaded');
    this.validateContractUploadFile(file);
    return this.teacherContractsService.createByUpload(dto, file, user);
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

  @Patch(':id/reminder')
  @ApiOperation({ summary: 'Create or edit renewal reminder for a contract' })
  updateReminder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeacherContractReminderDto,
    @CurrentUser() user: { userId: string; tenantSlug?: string; isSuperAdmin?: boolean },
  ) {
    return this.teacherContractsService.updateReminder(id, dto, user);
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

  private validateContractUploadFile(file: Express.Multer.File) {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Only PDF or DOCX contract files are accepted');
    }
    if (file.size > 15 * 1024 * 1024) {
      throw new BadRequestException('Contract file must be under 15 MB');
    }
  }
}

import { BadRequestException, Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateContractTemplateDto } from './dto/create-contract-template.dto';
import { CreateTeacherContractDto, TeacherContractStatus } from './dto/create-teacher-contract.dto';
import { DocumentCategory } from './document-categories';
import { CreateUploadedTeacherContractDto } from './dto/create-uploaded-teacher-contract.dto';
import { PreviewTeacherContractDto } from './dto/preview-teacher-contract.dto';
import { UpdateContractTemplateDto } from './dto/update-contract-template.dto';
import { UpdateTeacherContractReminderDto } from './dto/update-teacher-contract-reminder.dto';
import { UpdateTeacherContractDto } from './dto/update-teacher-contract.dto';
import { TeacherContractsService } from './teacher-contracts.service';

@ApiTags('Teacher Contracts')
@ApiBearerAuth()
@Controller('contracts')
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
        version: { type: 'number' },
        isActive: { type: 'boolean' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['name', 'file'],
    },
  })
  @ApiOperation({ summary: 'Create teacher/staff contract template' })
  createTemplate(
    @Body() dto: CreateContractTemplateDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { userId: string; tenantSlug?: string; isSuperAdmin?: boolean; role?: string },
  ) {
    if (!file) throw new BadRequestException('No template file uploaded');
    this.validateDocxTemplateFile(file);
    return this.teacherContractsService.createTemplate(dto, file, user);
  }

  @Post('templates/inspect')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } })
  @ApiOperation({ summary: 'Extract template variables from an uploaded DOCX without saving' })
  inspectTemplate(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No template file uploaded');
    this.validateDocxTemplateFile(file);
    return this.teacherContractsService.inspectTemplateFile(file);
  }

  @Post('templates/preview')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } })
  @ApiOperation({ summary: 'Render an uploaded DOCX template to a PDF preview' })
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'inline; filename="template-preview.pdf"')
  async previewTemplateFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No template file uploaded');
    this.validateDocxTemplateFile(file);
    return new StreamableFile(await this.teacherContractsService.previewTemplateFile(file));
  }

  @Get('templates')
  @ApiOperation({ summary: 'List contract templates' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'category', enum: DocumentCategory, required: false })
  findTemplates(
    @Query('isActive') isActive?: string,
    @Query('category') category?: DocumentCategory,
  ) {
    return this.teacherContractsService.findTemplates({
      isActive: isActive === undefined ? undefined : isActive === 'true',
      category,
    });
  }

  @Get('templates/:id/preview')
  @ApiOperation({ summary: 'Render a stored DOCX template to a PDF preview' })
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'inline; filename="template-preview.pdf"')
  async previewTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return new StreamableFile(await this.teacherContractsService.previewTemplateById(id));
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
    @CurrentUser() user: { userId: string; tenantSlug?: string; isSuperAdmin?: boolean; role?: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) this.validateDocxTemplateFile(file);
    return this.teacherContractsService.updateTemplate(id, dto, file, user);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Soft-delete contract template' })
  removeTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { userId: string; tenantSlug?: string; isSuperAdmin?: boolean; role?: string },
  ) {
    return this.teacherContractsService.removeTemplate(id, user);
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
  @ApiOperation({ summary: 'Retrieve contracts by staff, status, and period' })
  @ApiQuery({ name: 'teacherProfileId', required: false })
  @ApiQuery({ name: 'status', enum: TeacherContractStatus, required: false })
  @ApiQuery({ name: 'category', enum: DocumentCategory, required: false })
  @ApiQuery({ name: 'periodStart', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'periodEnd', required: false, description: 'YYYY-MM-DD' })
  findAll(
    @Query('teacherProfileId') teacherProfileId?: string,
    @Query('status') status?: TeacherContractStatus,
    @Query('category') category?: DocumentCategory,
    @Query('periodStart') periodStart?: string,
    @Query('periodEnd') periodEnd?: string,
  ) {
    return this.teacherContractsService.findAll({
      teacherProfileId,
      status,
      category,
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

  @Patch(':id/submit')
  @ApiOperation({ summary: 'Submit a draft document to its approver (draft → pending approval)' })
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { userId: string; tenantSlug?: string; isSuperAdmin?: boolean },
  ) {
    return this.teacherContractsService.submit(id, user);
  }

  @Patch(':id/publish')
  @ApiOperation({ summary: 'Alias of submit (back-compat)' })
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { userId: string; tenantSlug?: string; isSuperAdmin?: boolean },
  ) {
    return this.teacherContractsService.publish(id, user);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Approver rejects a submitted document' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: { userId: string; tenantSlug?: string; isSuperAdmin?: boolean; role?: string },
  ) {
    return this.teacherContractsService.reject(id, body.reason ?? '', user);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Configured signer (e.g. principal) approves & signs a pending document' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { eSignature: string },
    @CurrentUser() user: { userId: string; tenantSlug?: string; isSuperAdmin?: boolean; role?: string },
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

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a contract/document' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { userId: string; tenantSlug?: string; isSuperAdmin?: boolean },
  ) {
    return this.teacherContractsService.remove(id, user);
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

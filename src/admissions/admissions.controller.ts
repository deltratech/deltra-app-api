import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post,
  Query, Res, StreamableFile, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdmissionsService } from './admissions.service';
import { LettersService } from './letters.service';
import { StagesService } from './stages.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { SetStageDto } from './dto/transition.dto';
import { CreateStageDto, ReorderStagesDto, UpdateStageDto } from './dto/stage.dto';
import { BulkTransitionDto } from './dto/bulk-transition.dto';
import { VerifyDocumentDto } from './dto/document.dto';
import {
  AdmissionDocStatus, AdmissionDocType, AdmissionSchoolLevel,
} from './admissions.enums';

@ApiTags('Admissions')
@ApiBearerAuth()
@Controller('admissions')
export class AdmissionsController {
  constructor(
    private readonly service: AdmissionsService,
    private readonly letters: LettersService,
    private readonly stages: StagesService,
  ) {}

  // ── Pipeline stages (configurable) ──────────────────────────────────────────
  @Get('stages')
  @ApiOperation({ summary: 'List the configurable admission pipeline stages' })
  listStages() {
    return this.stages.list();
  }

  @Post('stages')
  @ApiOperation({ summary: 'Add a pipeline stage' })
  createStage(@Body() dto: CreateStageDto) {
    return this.stages.create(dto);
  }

  @Patch('stages/reorder')
  @ApiOperation({ summary: 'Reorder pipeline stages' })
  reorderStages(@Body() dto: ReorderStagesDto) {
    return this.stages.reorder(dto.ids);
  }

  @Patch('stages/:id')
  @ApiOperation({ summary: 'Update a pipeline stage' })
  updateStage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStageDto) {
    return this.stages.update(id, dto);
  }

  @Delete('stages/:id')
  @ApiOperation({ summary: 'Delete a pipeline stage (if empty)' })
  removeStage(@Param('id', ParseUUIDPipe) id: string) {
    return this.stages.remove(id);
  }

  @Get('applications')
  @ApiOperation({ summary: 'List admission applications (PPDB) in this branch' })
  @ApiQuery({ name: 'stageKey', required: false })
  @ApiQuery({ name: 'schoolLevel', enum: AdmissionSchoolLevel, required: false })
  @ApiQuery({ name: 'academicYear', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('stageKey') stageKey?: string,
    @Query('schoolLevel') schoolLevel?: AdmissionSchoolLevel,
    @Query('academicYear') academicYear?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      stageKey, schoolLevel, academicYear, search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('applications/export')
  @ApiOperation({ summary: 'Export applicants (matching the filter) as an .xlsx file' })
  @ApiQuery({ name: 'stageKey', required: false })
  @ApiQuery({ name: 'schoolLevel', enum: AdmissionSchoolLevel, required: false })
  @ApiQuery({ name: 'academicYear', required: false })
  @ApiQuery({ name: 'search', required: false })
  async exportApplications(
    @Res({ passthrough: true }) res: Response,
    @Query('stageKey') stageKey?: string,
    @Query('schoolLevel') schoolLevel?: AdmissionSchoolLevel,
    @Query('academicYear') academicYear?: string,
    @Query('search') search?: string,
  ) {
    const buf = await this.service.exportWorkbook({ stageKey, schoolLevel, academicYear, search });
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ppdb-applicants${stageKey ? '-' + stageKey : ''}.xlsx"`,
    });
    return new StreamableFile(buf);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Pipeline / stage counts for the admissions dashboard' })
  @ApiQuery({ name: 'academicYear', required: false })
  @ApiQuery({ name: 'schoolLevel', enum: AdmissionSchoolLevel, required: false })
  stats(
    @Query('academicYear') academicYear?: string,
    @Query('schoolLevel') schoolLevel?: AdmissionSchoolLevel,
  ) {
    return this.service.stats({ academicYear, schoolLevel });
  }

  // Read-only level defaults (test gate / grade labels) — used by the public form
  // and the admin Add-applicant grade dropdowns. No admin editing UI.
  @Get('level-settings')
  @ApiOperation({ summary: 'Per-level defaults (test gate, grade labels)' })
  listLevelSettings() {
    return this.service.listLevelSettings();
  }

  @Get('applications/:id')
  @ApiOperation({ summary: 'Get one application with its documents' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post('applications')
  @ApiOperation({ summary: 'Create / register a new applicant' })
  create(@Body() dto: CreateApplicationDto) {
    return this.service.create(dto);
  }

  @Patch('applications/:id')
  @ApiOperation({ summary: 'Update applicant details' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateApplicationDto) {
    return this.service.update(id, dto);
  }

  @Patch('applications/:id/stage')
  @ApiOperation({ summary: 'Move an application to a stage (role drives side-effects)' })
  setStage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetStageDto) {
    return this.service.setStage(id, dto);
  }

  @Post('applications/bulk')
  @ApiOperation({ summary: 'Apply one stage transition to many applications (by ids or filter)' })
  bulk(@Body() dto: BulkTransitionDto) {
    return this.service.bulkTransition(dto);
  }

  @Post('letters/bulk-issue')
  @ApiOperation({ summary: 'Issue acceptance letters for many applications (by ids)' })
  bulkIssueLetters(@Body() body: { ids: string[] }) {
    return this.letters.bulkIssue(body?.ids ?? []);
  }

  @Post('applications/:id/issue-letter')
  @ApiOperation({ summary: 'Generate + store the acceptance letter and mark it issued' })
  issueLetter(@Param('id', ParseUUIDPipe) id: string) {
    return this.letters.issueLetter(id);
  }

  @Get('applications/:id/letter/preview')
  @ApiOperation({ summary: 'Render the acceptance letter PDF without saving (admin preview)' })
  async previewLetter(@Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    const buf = await this.letters.previewLetter(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="acceptance-letter-preview.pdf"',
    });
    return new StreamableFile(buf);
  }

  @Patch('applications/:id/block')
  @ApiOperation({ summary: 'Block (put on hold) or unblock an application' })
  block(@Param('id', ParseUUIDPipe) id: string, @Body() body: { blocked: boolean; reason?: string }) {
    return this.service.setBlocked(id, !!body.blocked, body.reason);
  }

  @Delete('applications/:id')
  @ApiOperation({ summary: 'Soft-delete an application' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  // ── Documents ──────────────────────────────────────────────────────────────
  @Get('documents')
  @ApiOperation({ summary: 'Document verification queue across all applications' })
  @ApiQuery({ name: 'status', enum: AdmissionDocStatus, required: false })
  listDocumentQueue(@Query('status') status?: AdmissionDocStatus) {
    return this.service.listDocumentQueue({ status });
  }

  @Get('applications/:id/documents')
  @ApiOperation({ summary: 'List documents for an application' })
  listDocuments(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listDocuments(id);
  }

  @Post('applications/:id/documents')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        documentType: { type: 'string', enum: Object.values(AdmissionDocType) },
        file: { type: 'string', format: 'binary' },
      },
      required: ['documentType', 'file'],
    },
  })
  @ApiOperation({ summary: 'Upload a document file and attach it to an application' })
  uploadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('documentType') documentType: AdmissionDocType,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { tenantSlug: string },
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!Object.values(AdmissionDocType).includes(documentType)) {
      throw new BadRequestException('Invalid or missing documentType');
    }
    if (file.size > 10 * 1024 * 1024) throw new BadRequestException('File must be under 10 MB');
    return this.service.addDocumentFile(id, documentType, file, user.tenantSlug);
  }

  @Patch('documents/:docId/verify')
  @ApiOperation({ summary: 'Verify or reject an application document' })
  verifyDocument(
    @Param('docId', ParseUUIDPipe) docId: string,
    @Body() dto: VerifyDocumentDto,
    @CurrentUser() user: { userId: string },
  ) {
    return this.service.verifyDocument(docId, dto, user);
  }
}

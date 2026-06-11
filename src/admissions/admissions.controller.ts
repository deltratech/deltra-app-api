import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post,
  Query, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdmissionsService } from './admissions.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { AssignTestDto, DecisionDto, RecordResultDto } from './dto/transition.dto';
import { VerifyDocumentDto } from './dto/document.dto';
import {
  AdmissionDocStatus, AdmissionDocType, AdmissionSchoolLevel, AdmissionStage,
} from './admissions.enums';

@ApiTags('Admissions')
@ApiBearerAuth()
@Controller('admissions')
export class AdmissionsController {
  constructor(private readonly service: AdmissionsService) {}

  @Get('applications')
  @ApiOperation({ summary: 'List admission applications (PPDB) in this branch' })
  @ApiQuery({ name: 'stage', enum: AdmissionStage, required: false })
  @ApiQuery({ name: 'schoolLevel', enum: AdmissionSchoolLevel, required: false })
  @ApiQuery({ name: 'academicYear', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('stage') stage?: AdmissionStage,
    @Query('schoolLevel') schoolLevel?: AdmissionSchoolLevel,
    @Query('academicYear') academicYear?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      stage, schoolLevel, academicYear, search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
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

  @Patch('applications/:id/assign-test')
  @ApiOperation({ summary: 'Assign a test/interview date (→ tested)' })
  assignTest(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignTestDto) {
    return this.service.assignTest(id, dto);
  }

  @Patch('applications/:id/result')
  @ApiOperation({ summary: 'Record test result (→ passed/failed)' })
  recordResult(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordResultDto) {
    return this.service.recordResult(id, dto);
  }

  @Patch('applications/:id/decision')
  @ApiOperation({ summary: 'Accept or reject an applicant' })
  decide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto) {
    return this.service.decide(id, dto);
  }

  @Patch('applications/:id/enroll')
  @ApiOperation({ summary: 'Mark an accepted applicant as enrolled' })
  enroll(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.enroll(id);
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

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { FindAssignmentsQueryDto } from './dto/find-assignments-query.dto';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { UpdateMySubmissionDto } from './dto/update-my-submission.dto';
import { FindGradebookQueryDto } from './dto/find-gradebook-query.dto';
import { FindStudentAssignmentsQueryDto } from './dto/find-student-assignments-query.dto';
import { FindParentAssignmentsQueryDto } from './dto/find-parent-assignments-query.dto';

type CurrentUserContext = {
  userId: string;
  role?: string;
  tenantSlug?: string;
};

const FILE_BODY_SCHEMA = {
  schema: {
    type: 'object',
    properties: { file: { type: 'string', format: 'binary' } },
    required: ['file'],
  },
} as const;

@ApiTags('Assignments')
@ApiBearerAuth()
@Controller()
export class AssignmentsController {
  constructor(private readonly service: AssignmentsService) {}

  // ── Assignment CRUD + lifecycle (teacher) ─────────────────────────────────

  @Post('assignments')
  @ApiOperation({ summary: 'Create a draft assignment (subject teacher only)' })
  create(
    @CurrentUser() user: CurrentUserContext,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.service.create(user, dto);
  }

  @Get('assignments')
  @ApiOperation({
    summary: 'List assignments, scoped by role (teacher/student/admin)',
  })
  findAll(
    @CurrentUser() user: CurrentUserContext,
    @Query() query: FindAssignmentsQueryDto,
  ) {
    return this.service.findAll(user, query);
  }

  // Static routes MUST be declared before 'assignments/:id'.

  @Get('assignments/gradebook')
  @ApiOperation({
    summary:
      'Gradebook matrix (students × assignments) for one class + subject',
  })
  gradebook(
    @CurrentUser() user: CurrentUserContext,
    @Query() query: FindGradebookQueryDto,
  ) {
    return this.service.gradebook(user, query);
  }

  @Get('assignments/parent')
  @ApiOperation({
    summary: 'Parent view: linked students with their assignments and grades',
  })
  findParentAssignments(
    @CurrentUser() user: CurrentUserContext,
    @Query() query: FindParentAssignmentsQueryDto,
  ) {
    return this.service.findParentAssignments(user, query);
  }

  @Get('assignments/teaching-context')
  @ApiOperation({
    summary:
      'Classes + subjects the current teacher teaches (powers the create-assignment form)',
  })
  getTeachingContext(@CurrentUser() user: CurrentUserContext) {
    return this.service.getTeachingContext(user);
  }

  @Get('assignments/:id')
  @ApiOperation({ summary: 'Get one assignment (role-scoped detail)' })
  findOne(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(user, id);
  }

  @Patch('assignments/:id')
  @ApiOperation({ summary: 'Update an assignment (subject teacher only)' })
  update(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete('assignments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an assignment (subject teacher only)' })
  remove(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(user, id);
  }

  @Patch('assignments/:id/publish')
  @ApiOperation({
    summary:
      'Publish a draft assignment (visible to students, submissions open)',
  })
  publish(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.publish(user, id);
  }

  @Patch('assignments/:id/close')
  @ApiOperation({
    summary: 'Close a published assignment (blocks new submissions)',
  })
  close(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.close(user, id);
  }

  // ── Instruction attachments (teacher) ─────────────────────────────────────

  @Post('assignments/:id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload an instruction file (PDF/Office/text/image/ZIP ≤ 20 MB)',
  })
  addAttachment(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.addAttachment(user, id, file, user.tenantSlug!);
  }

  @Delete('assignments/:id/attachments/:attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an instruction file' })
  removeAttachment(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.service.removeAttachment(user, id, attachmentId);
  }

  // ── Submissions roster + grading (teacher) ────────────────────────────────

  @Get('assignments/:id/submissions')
  @ApiOperation({
    summary:
      'Roster of all enrolled students with their submission (or null) + summary',
  })
  listSubmissions(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.listSubmissions(user, id);
  }

  @Patch('assignments/:id/submissions/:submissionId/grade')
  @ApiOperation({
    summary:
      'Grade a submission (score + optional feedback); re-callable to regrade',
  })
  gradeSubmission(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: GradeSubmissionDto,
  ) {
    return this.service.gradeSubmission(user, id, submissionId, dto);
  }

  @Patch('assignments/:id/submissions/:submissionId/return')
  @ApiOperation({
    summary: 'Return a graded submission for revision (reopens resubmission)',
  })
  returnSubmission(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ) {
    return this.service.returnSubmission(user, id, submissionId);
  }

  // ── Own submission (student) ──────────────────────────────────────────────

  @Get('assignments/:id/submission')
  @ApiOperation({ summary: 'Get my submission for this assignment (student)' })
  getMySubmission(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getMySubmission(user, id);
  }

  @Post('assignments/:id/submission/attachments')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Submit a file (student). First upload creates the submission; later uploads append files and refresh submittedAt',
  })
  submitFile(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.submitFile(user, id, file, user.tenantSlug!);
  }

  @Patch('assignments/:id/submission')
  @ApiOperation({ summary: 'Update my submission notes (student)' })
  updateMySubmission(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMySubmissionDto,
  ) {
    return this.service.updateMySubmission(user, id, dto);
  }

  @Delete('assignments/:id/submission/attachments/:attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove one of my submission files (blocked once graded)',
  })
  removeMySubmissionAttachment(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.service.removeMySubmissionAttachment(user, id, attachmentId);
  }

  // ── Per-student view (mirrors GET /student/attendance/:studentId) ─────────

  @Get('student/assignments/:studentId')
  @ApiOperation({
    summary:
      'Get student assignments + grades, with deny-by-default access checks',
  })
  @ApiParam({
    name: 'studentId',
    description: 'Student profile ID or student user ID',
  })
  findStudentAssignments(
    @CurrentUser() user: CurrentUserContext,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Query() query: FindStudentAssignmentsQueryDto,
  ) {
    return this.service.findStudentAssignments(user, studentId, query);
  }
}

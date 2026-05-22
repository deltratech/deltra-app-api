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
import { StudentPortfoliosService } from './student-portfolios.service';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { PortfolioType } from '../common/enums/portfolio-type.enum';

@ApiTags('Student Portfolios')
@ApiSecurity('x-api-key')
@Controller('student-portfolios')
export class StudentPortfoliosController {
  constructor(private readonly service: StudentPortfoliosService) {}

  @Get()
  @ApiOperation({ summary: 'List portfolio entries with optional filters' })
  @ApiQuery({ name: 'studentProfileId', required: false })
  @ApiQuery({ name: 'type',             required: false, enum: PortfolioType })
  @ApiQuery({ name: 'year',             required: false, type: Number })
  @ApiQuery({ name: 'classroomId',      required: false })
  @ApiQuery({ name: 'search',           required: false, description: 'Search by title or description' })
  @ApiQuery({ name: 'page',             required: false, type: Number })
  @ApiQuery({ name: 'limit',            required: false, type: Number })
  findAll(
    @Query('studentProfileId') studentProfileId?: string,
    @Query('type')             type?: PortfolioType,
    @Query('year',  new ParseIntPipe({ optional: true })) year?: number,
    @Query('classroomId')      classroomId?: string,
    @Query('search')           search?: string,
    @Query('page',  new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.service.findAll({ studentProfileId, type, year, classroomId, search, page, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a portfolio entry by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a portfolio entry' })
  create(@Body() dto: CreatePortfolioDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a portfolio entry' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePortfolioDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a portfolio entry and its attachments' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  // ── Attachments ───────────────────────────────────────────────────────────────

  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Upload an attachment to a portfolio entry (JPEG/PNG/WebP/PDF ≤ 10 MB)' })
  addAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { tenantSlug: string },
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.service.addAttachment(id, file, user.tenantSlug);
  }

  @Delete(':id/attachments/:attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an attachment from a portfolio entry' })
  removeAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.service.removeAttachment(id, attachmentId);
  }
}

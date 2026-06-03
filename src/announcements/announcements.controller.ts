import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseBoolPipe, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AnnouncementAudienceType, AnnouncementStatus, AnnouncementTemplateCategory } from '../common/enums/announcement.enum';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { CreateAnnouncementTemplateDto } from './dto/create-announcement-template.dto';
import { UpdateAnnouncementTemplateDto } from './dto/update-announcement-template.dto';

type ActorContext = { userId: string; role?: string; tenantSlug?: string };

@ApiTags('Announcements')
@ApiBearerAuth()
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly service: AnnouncementsService) {}

  @Get()
  @ApiOperation({ summary: 'List announcements' })
  @ApiQuery({ name: 'audienceType', enum: AnnouncementAudienceType, required: false })
  @ApiQuery({ name: 'status', enum: AnnouncementStatus, required: false })
  @ApiQuery({ name: 'pinned', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('audienceType') audienceType?: AnnouncementAudienceType,
    @Query('status') status?: AnnouncementStatus,
    @Query('pinned', new ParseBoolPipe({ optional: true })) pinned?: boolean,
    @Query('search') search?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.service.findAll({ audienceType, status, pinned, search, page, limit });
  }

  @Get('templates')
  @ApiOperation({ summary: 'List announcement templates' })
  @ApiQuery({ name: 'category', enum: AnnouncementTemplateCategory, required: false })
  findTemplates(@Query('category') category?: AnnouncementTemplateCategory) {
    return this.service.findTemplates(category);
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create an announcement template' })
  createTemplate(@Body() dto: CreateAnnouncementTemplateDto) {
    return this.service.createTemplate(dto);
  }

  @Post('send-due')
  @ApiOperation({ summary: 'Send scheduled announcements whose scheduledAt has passed' })
  sendDue(@CurrentUser() user: ActorContext) {
    return this.service.sendDueScheduled(user);
  }

  @Patch('templates/:id')
  @ApiOperation({ summary: 'Update an announcement template' })
  updateTemplate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAnnouncementTemplateDto) {
    return this.service.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an announcement template' })
  removeTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeTemplate(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an announcement by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an announcement' })
  create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: ActorContext) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an announcement' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAnnouncementDto, @CurrentUser() user: ActorContext) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an announcement' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: ActorContext) {
    return this.service.remove(id, user);
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'Resolve recipients and send/queue announcement deliveries' })
  send(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: ActorContext) {
    return this.service.send(id, user);
  }

  @Patch(':id/pin')
  @ApiOperation({ summary: 'Pin an announcement' })
  pin(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: ActorContext) {
    return this.service.setPinned(id, true, user);
  }

  @Patch(':id/unpin')
  @ApiOperation({ summary: 'Unpin an announcement' })
  unpin(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: ActorContext) {
    return this.service.setPinned(id, false, user);
  }

  @Patch(':id/recipients/:recipientId/read')
  @ApiOperation({ summary: 'Mark announcement as read for a recipient' })
  markRead(@Param('id', ParseUUIDPipe) id: string, @Param('recipientId', ParseUUIDPipe) recipientId: string) {
    return this.service.markRead(id, recipientId);
  }

  @Get(':id/delivery-logs')
  @ApiOperation({ summary: 'List delivery logs for an announcement' })
  findDeliveryLogs(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findDeliveryLogs(id);
  }

  @Get(':id/audit-logs')
  @ApiOperation({ summary: 'List audit logs for an announcement' })
  findAuditLogs(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findAuditLogs(id);
  }
}

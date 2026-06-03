import { Body, Controller, Delete, Get, Param, ParseBoolPipe, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RegisterPushDeviceDto } from './dto/register-push-device.dto';
import { TestPushNotificationDto } from './dto/test-push-notification.dto';
import { FcmService } from './fcm.service';
import { NotificationsService } from './notifications.service';
import { NotificationCategory, NotificationPriority } from '../common/enums/notification.enum';

type CurrentUserContext = { userId: string; tenantSlug?: string };

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly fcm: FcmService,
  ) {}

  @Get('fcm-config')
  @ApiOperation({ summary: 'Get Firebase web config for browser push setup' })
  getFcmConfig() {
    return this.fcm.getWebConfig();
  }

  @Get()
  @ApiOperation({ summary: 'List current user notifications' })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'category', enum: NotificationCategory, required: false })
  @ApiQuery({ name: 'priority', enum: NotificationPriority, required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findMine(
    @CurrentUser() user: CurrentUserContext,
    @Query('unreadOnly', new ParseBoolPipe({ optional: true })) unreadOnly?: boolean,
    @Query('category') category?: NotificationCategory,
    @Query('priority') priority?: NotificationPriority,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.service.findMine(user.userId, { unreadOnly, category, priority, page, limit });
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(@CurrentUser() user: CurrentUserContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.markRead(user.userId, id);
  }

  @Get('devices')
  @ApiOperation({ summary: 'List current user push devices' })
  findMyDevices(@CurrentUser() user: CurrentUserContext) {
    return this.service.findMyDevices(user.userId);
  }

  @Post('devices')
  @ApiOperation({ summary: 'Register or refresh an FCM web push token for current user' })
  registerDevice(@CurrentUser() user: CurrentUserContext, @Body() dto: RegisterPushDeviceDto) {
    return this.service.registerDevice(user.userId, dto);
  }

  @Delete('devices/:id')
  @ApiOperation({ summary: 'Revoke current user push device token' })
  revokeDevice(@CurrentUser() user: CurrentUserContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.revokeDevice(user.userId, id);
  }

  @Post('test')
  @ApiOperation({ summary: 'Create and queue a test push notification for current user' })
  sendTest(@CurrentUser() user: CurrentUserContext, @Body() dto: TestPushNotificationDto) {
    return this.service.sendTest(user, dto);
  }
}

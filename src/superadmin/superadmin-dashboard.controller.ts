import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SuperadminDashboardService } from './superadmin-dashboard.service';

type SuperadminActor = {
  userId: string;
  isPlatformUser?: boolean;
  isSuperAdmin?: boolean;
};

@ApiTags('Superadmin')
@ApiBearerAuth()
@Controller('superadmin')
export class SuperadminDashboardController {
  constructor(private readonly dashboardService: SuperadminDashboardService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get aggregated superadmin dashboard overview' })
  getDashboard(@CurrentUser() user: SuperadminActor) {
    return this.dashboardService.getDashboard(user);
  }
}

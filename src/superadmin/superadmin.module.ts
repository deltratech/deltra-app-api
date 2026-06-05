import { Module } from '@nestjs/common';
import { SuperadminDashboardController } from './superadmin-dashboard.controller';
import { SuperadminDashboardService } from './superadmin-dashboard.service';

@Module({
  controllers: [SuperadminDashboardController],
  providers: [SuperadminDashboardService],
})
export class SuperadminModule {}

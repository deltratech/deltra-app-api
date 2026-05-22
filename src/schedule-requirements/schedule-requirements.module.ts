import { Module } from '@nestjs/common';
import { ScheduleRequirementsController } from './schedule-requirements.controller';
import { ScheduleRequirementsService } from './schedule-requirements.service';

@Module({
  controllers: [ScheduleRequirementsController],
  providers: [ScheduleRequirementsService],
  exports: [ScheduleRequirementsService],
})
export class ScheduleRequirementsModule {}

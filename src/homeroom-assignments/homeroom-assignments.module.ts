import { Module } from '@nestjs/common';
import { HomeroomAssignmentsController } from './homeroom-assignments.controller';
import { HomeroomAssignmentsService } from './homeroom-assignments.service';

@Module({
  controllers: [HomeroomAssignmentsController],
  providers: [HomeroomAssignmentsService],
})
export class HomeroomAssignmentsModule {}

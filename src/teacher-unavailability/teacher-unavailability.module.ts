import { Module } from '@nestjs/common';
import { TeacherUnavailabilityController } from './teacher-unavailability.controller';
import { TeacherUnavailabilityService } from './teacher-unavailability.service';

@Module({
  controllers: [TeacherUnavailabilityController],
  providers: [TeacherUnavailabilityService],
  exports: [TeacherUnavailabilityService],
})
export class TeacherUnavailabilityModule {}

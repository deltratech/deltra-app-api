import { Module } from '@nestjs/common';
import { StudentProfilesController } from './student-profiles.controller';
import { StudentProfilesService } from './student-profiles.service';

@Module({
  controllers: [StudentProfilesController],
  providers: [StudentProfilesService],
  exports: [StudentProfilesService],
})
export class StudentProfilesModule {}

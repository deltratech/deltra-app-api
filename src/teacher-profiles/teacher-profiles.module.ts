import { Module } from '@nestjs/common';
import { TeacherProfilesController } from './teacher-profiles.controller';
import { TeacherProfilesService } from './teacher-profiles.service';

@Module({
  controllers: [TeacherProfilesController],
  providers: [TeacherProfilesService],
  exports: [TeacherProfilesService],
})
export class TeacherProfilesModule {}

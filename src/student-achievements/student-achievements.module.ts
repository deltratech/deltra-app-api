import { Module } from '@nestjs/common';
import { StudentAchievementsController } from './student-achievements.controller';
import { StudentAchievementsService } from './student-achievements.service';

@Module({
  controllers: [StudentAchievementsController],
  providers: [StudentAchievementsService],
  exports: [StudentAchievementsService],
})
export class StudentAchievementsModule {}

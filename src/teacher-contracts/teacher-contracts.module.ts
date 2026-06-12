import { Module } from '@nestjs/common';
import { TeacherContractsService } from './teacher-contracts.service';
import { TeacherContractsController } from './teacher-contracts.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [TeacherContractsController],
  providers: [TeacherContractsService],
})
export class TeacherContractsModule {}

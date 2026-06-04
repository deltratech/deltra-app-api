import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AcademicNotesController } from './academic-notes.controller';
import { AcademicNotesService } from './academic-notes.service';

@Module({
  imports: [NotificationsModule],
  controllers: [AcademicNotesController],
  providers: [AcademicNotesService],
  exports: [AcademicNotesService],
})
export class AcademicNotesModule {}

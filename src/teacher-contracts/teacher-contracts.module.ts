import { Module } from '@nestjs/common';
import { TeacherContractsService } from './teacher-contracts.service';
import { TeacherContractsController } from './teacher-contracts.controller';

@Module({
  controllers: [TeacherContractsController],
  providers: [TeacherContractsService],
})
export class TeacherContractsModule {}

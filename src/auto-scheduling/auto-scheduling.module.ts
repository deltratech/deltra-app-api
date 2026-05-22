import { Module } from '@nestjs/common';
import { AutoSchedulingController } from './auto-scheduling.controller';
import { AutoSchedulingService } from './auto-scheduling.service';

@Module({
  controllers: [AutoSchedulingController],
  providers: [AutoSchedulingService],
})
export class AutoSchedulingModule {}

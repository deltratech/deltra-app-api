import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AutoSchedulingService } from './auto-scheduling.service';
import { GenerateScheduleDto } from './dto/generate-schedule.dto';

@ApiTags('Auto Scheduling')
@ApiBearerAuth()
@Controller('auto-scheduling')
export class AutoSchedulingController {
  constructor(private readonly service: AutoSchedulingService) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Run the greedy auto-scheduler',
    description:
      'Loads all ScheduleRequirements for the given academic year/semester, ' +
      'sorts by difficulty, and greedily assigns teacher/class/room/slot combinations ' +
      'while enforcing all hard constraints. ' +
      'Returns stats, a debug log, and any unresolved requirements. ' +
      'Generated schedules are saved as DRAFT and can be edited or published manually.',
  })
  generate(@Body() dto: GenerateScheduleDto) {
    return this.service.generate(dto);
  }
}

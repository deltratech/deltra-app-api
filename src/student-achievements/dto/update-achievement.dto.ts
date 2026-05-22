import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateAchievementDto } from './create-achievement.dto';

export class UpdateAchievementDto extends PartialType(
  OmitType(CreateAchievementDto, ['studentProfileId'] as const),
) {}

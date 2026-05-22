import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePortfolioDto } from './create-portfolio.dto';

export class UpdatePortfolioDto extends PartialType(
  OmitType(CreatePortfolioDto, ['studentProfileId'] as const),
) {}

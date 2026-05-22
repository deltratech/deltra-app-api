import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { AchievementCategory } from '../../common/enums/achievement-category.enum';
import { AchievementLevel } from '../../common/enums/achievement-level.enum';

export class CreateAchievementDto {
  @ApiProperty()
  @IsUUID()
  studentProfileId: string;

  @ApiProperty({ example: 'Juara 1 Olimpiade Matematika Tingkat Provinsi' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ enum: AchievementCategory })
  @IsEnum(AchievementCategory)
  category: AchievementCategory;

  @ApiPropertyOptional({ enum: AchievementLevel })
  @IsOptional()
  @IsEnum(AchievementLevel)
  level?: AchievementLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Dinas Pendidikan Provinsi Jawa Barat' })
  @IsOptional()
  @IsString()
  organizer?: string;

  @ApiPropertyOptional({ example: 'Olimpiade Sains Nasional 2024' })
  @IsOptional()
  @IsString()
  eventName?: string;

  @ApiProperty({ example: '2024-08-17', description: 'Date the achievement was obtained' })
  @IsDateString()
  achievedAt: string;

  @ApiPropertyOptional({ example: '1st Place' })
  @IsOptional()
  @IsString()
  rank?: string;
}

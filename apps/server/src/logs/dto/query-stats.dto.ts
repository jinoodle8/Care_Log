import { IsIn, IsString } from 'class-validator';

const RANGES = ['day', 'week'] as const;

export class QueryStatsDto {
  @IsString()
  elderId: string;

  @IsIn(RANGES)
  range: (typeof RANGES)[number];
}

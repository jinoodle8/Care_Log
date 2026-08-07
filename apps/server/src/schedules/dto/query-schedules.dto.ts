import { IsString } from 'class-validator';

export class QuerySchedulesDto {
  @IsString()
  elderId: string;
}

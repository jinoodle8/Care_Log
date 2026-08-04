import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import type { LogStats, MedicationLog } from '@carelog/shared';
import { CreateLogDto } from './dto/create-log.dto';
import { QueryLogsDto } from './dto/query-logs.dto';
import { QueryStatsDto } from './dto/query-stats.dto';
import { LogsService } from './logs.service';

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateLogDto): Promise<MedicationLog> {
    return this.logsService.create(dto);
  }

  @Get('stats')
  getStats(@Query() query: QueryStatsDto): Promise<LogStats> {
    return this.logsService.getStats(query);
  }

  @Get()
  findMany(@Query() query: QueryLogsDto): Promise<MedicationLog[]> {
    return this.logsService.findMany(query);
  }
}

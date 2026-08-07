import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { LogStats, MedicationLog, Role } from '@carelog/shared';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateLogDto } from './dto/create-log.dto';
import { ManualConfirmDto } from './dto/manual-confirm.dto';
import { QueryLogsDto } from './dto/query-logs.dto';
import { QueryStatsDto } from './dto/query-stats.dto';
import { LogsService } from './logs.service';

interface AuthUser {
  id: string;
  role: Role;
}

@Controller('logs')
@UseGuards(JwtAuthGuard)
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  /** 어르신 기기가 자신의 복약 로그를 올린다. elderId는 토큰에서 유도한다. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() req: Request,
    @Body() dto: CreateLogDto,
  ): Promise<MedicationLog> {
    const user = req.user as AuthUser;
    return this.logsService.create(user, dto);
  }

  @Get('stats')
  getStats(
    @Req() req: Request,
    @Query() query: QueryStatsDto,
  ): Promise<LogStats> {
    const user = req.user as AuthUser;
    return this.logsService.getStats(user, query);
  }

  @Get()
  findMany(
    @Req() req: Request,
    @Query() query: QueryLogsDto,
  ): Promise<MedicationLog[]> {
    const user = req.user as AuthUser;
    return this.logsService.findMany(user, query);
  }

  /** 보호자가 UNCERTAIN 건을 복약 확인/미복용으로 정리한다. */
  @Patch(':id/manual-confirm')
  manualConfirm(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ManualConfirmDto,
  ): Promise<MedicationLog> {
    const user = req.user as AuthUser;
    return this.logsService.manualConfirm(user, id, dto);
  }
}

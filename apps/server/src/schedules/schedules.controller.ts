import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Role, Schedule } from '@carelog/shared';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { QuerySchedulesDto } from './dto/query-schedules.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { SchedulesService } from './schedules.service';

interface AuthUser {
  id: string;
  role: Role;
}

@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  // 스케줄 설정은 보호자가 대신 한다(PRD 4.3.6). 조회는 어르신 앱도 필요하므로
  // (로컬 알림 동기화, M3-07) 역할을 제한하지 않고 서비스에서 소유권만 확인한다.
  @Roles('GUARDIAN')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() req: Request,
    @Body() dto: CreateScheduleDto,
  ): Promise<Schedule> {
    return this.schedulesService.create(req.user as AuthUser, dto);
  }

  @Get()
  findMany(
    @Req() req: Request,
    @Query() query: QuerySchedulesDto,
  ): Promise<Schedule[]> {
    return this.schedulesService.findMany(req.user as AuthUser, query.elderId);
  }

  @Roles('GUARDIAN')
  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ): Promise<Schedule> {
    return this.schedulesService.update(req.user as AuthUser, id, dto);
  }

  @Roles('GUARDIAN')
  @Delete(':id')
  remove(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ id: string }> {
    return this.schedulesService.remove(req.user as AuthUser, id);
  }
}

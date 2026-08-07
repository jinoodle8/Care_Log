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
  UseGuards,
} from '@nestjs/common';
import type { Role, Schedule } from '@carelog/shared';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { QuerySchedulesDto } from './dto/query-schedules.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { SchedulesService } from './schedules.service';

interface AuthUser {
  id: string;
  role: Role;
}

@Controller('schedules')
@UseGuards(JwtAuthGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

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

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ): Promise<Schedule> {
    return this.schedulesService.update(req.user as AuthUser, id, dto);
  }

  @Delete(':id')
  remove(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ id: string }> {
    return this.schedulesService.remove(req.user as AuthUser, id);
  }
}

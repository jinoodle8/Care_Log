import { Injectable } from '@nestjs/common';
import type { Role, Schedule } from '@carelog/shared';
import type { Schedule as ScheduleRecord } from '@prisma/client';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

export interface AuthUser {
  id: string;
  role: Role;
}

@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthUser, dto: CreateScheduleDto): Promise<Schedule> {
    await this.assertCanManageElder(user, dto.elderId);

    const existing = await this.prisma.schedule.findUnique({
      where: { elderId_slot: { elderId: dto.elderId, slot: dto.slot } },
    });
    if (existing) {
      throw new AppException(
        'SCHEDULE_SLOT_DUPLICATE',
        '해당 시간대의 스케줄이 이미 있습니다.',
      );
    }

    const record = await this.prisma.schedule.create({
      data: {
        elderId: dto.elderId,
        slot: dto.slot,
        time: dto.time,
        enabled: dto.enabled ?? true,
      },
    });
    return toSchedule(record);
  }

  async findMany(user: AuthUser, elderId: string): Promise<Schedule[]> {
    await this.assertCanManageElder(user, elderId);

    const records = await this.prisma.schedule.findMany({
      where: { elderId },
      orderBy: { time: 'asc' },
    });
    return records.map(toSchedule);
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateScheduleDto,
  ): Promise<Schedule> {
    const target = await this.getOwnedSchedule(user, id);

    const record = await this.prisma.schedule.update({
      where: { id: target.id },
      data: { time: dto.time, enabled: dto.enabled },
    });
    return toSchedule(record);
  }

  async remove(user: AuthUser, id: string): Promise<{ id: string }> {
    const target = await this.getOwnedSchedule(user, id);
    await this.prisma.schedule.delete({ where: { id: target.id } });
    return { id: target.id };
  }

  private async getOwnedSchedule(
    user: AuthUser,
    id: string,
  ): Promise<ScheduleRecord> {
    const record = await this.prisma.schedule.findUnique({ where: { id } });
    if (!record) {
      throw new AppException(
        'SCHEDULE_NOT_FOUND',
        '스케줄을 찾을 수 없습니다.',
        404,
      );
    }
    await this.assertCanManageElder(user, record.elderId);
    return record;
  }

  /** 어르신은 자기 스케줄만, 보호자는 연동된 어르신의 스케줄만 다룰 수 있다. */
  private async assertCanManageElder(
    user: AuthUser,
    elderId: string,
  ): Promise<void> {
    if (user.role === 'ELDER') {
      if (user.id !== elderId) {
        throw new AppException(
          'FORBIDDEN',
          '본인의 스케줄만 조회할 수 있습니다.',
          403,
        );
      }
      return;
    }

    const link = await this.prisma.link.findUnique({
      where: { elderId_guardianId: { elderId, guardianId: user.id } },
    });
    if (!link) {
      throw new AppException(
        'NOT_LINKED_ELDER',
        '연동되지 않은 어르신입니다.',
        403,
      );
    }
  }
}

function toSchedule(record: ScheduleRecord): Schedule {
  return {
    id: record.id,
    elderId: record.elderId,
    slot: record.slot,
    time: record.time,
    enabled: record.enabled,
  };
}

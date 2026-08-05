import { Injectable } from '@nestjs/common';
import type { LogStats, Role } from '@carelog/shared';
import type { MedicationLog } from '@carelog/shared';
import { calculateLogStats } from '@carelog/shared';
import type {
  Prisma,
  MedicationLog as MedicationLogRecord,
} from '@prisma/client';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateLogDto } from './dto/create-log.dto';
import { QueryLogsDto } from './dto/query-logs.dto';
import { QueryStatsDto } from './dto/query-stats.dto';

export interface AuthUser {
  id: string;
  role: Role;
}

@Injectable()
export class LogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** 어르신 기기만 자신의 로그를 올릴 수 있다. elderId는 토큰에서 유도한다. */
  async create(user: AuthUser, dto: CreateLogDto): Promise<MedicationLog> {
    if (user.role !== 'ELDER') {
      throw new AppException(
        'FORBIDDEN',
        '어르신 계정만 복약 로그를 올릴 수 있습니다.',
        403,
      );
    }

    const record = await this.prisma.medicationLog.create({
      data: {
        elderId: user.id,
        scheduleId: dto.scheduleId,
        takenAt: new Date(dto.takenAt),
        decision: dto.decision,
        sequenceConf: dto.sequenceConf,
        detectionsJson: dto.detections as unknown as Prisma.InputJsonValue,
        actionSequenceJson: dto.actionSequence,
        videoRef: dto.videoRef,
        deviceInfo: dto.deviceInfo as unknown as
          Prisma.InputJsonValue | undefined,
      },
    });

    const log = toMedicationLog(record);
    // 보호자 앱이 새로고침 없이 현황을 갱신할 수 있도록 브로드캐스트한다(M2-19).
    this.realtime.emitLogCreated(log);
    return log;
  }

  async findMany(
    user: AuthUser,
    query: QueryLogsDto,
  ): Promise<MedicationLog[]> {
    await this.assertCanAccessElder(user, query.elderId);

    const records = await this.prisma.medicationLog.findMany({
      where: {
        elderId: query.elderId,
        decision: query.decision,
        takenAt: {
          gte: query.from ? new Date(query.from) : undefined,
          lte: query.to ? new Date(query.to) : undefined,
        },
      },
      orderBy: { takenAt: 'desc' },
    });
    return records.map(toMedicationLog);
  }

  async getStats(user: AuthUser, query: QueryStatsDto): Promise<LogStats> {
    await this.assertCanAccessElder(user, query.elderId);

    const { from, to } = resolveRangeBounds(query.range);
    const records = await this.prisma.medicationLog.findMany({
      where: { elderId: query.elderId, takenAt: { gte: from, lte: to } },
      select: { decision: true },
    });
    return calculateLogStats(
      records.map((record) => record.decision),
      query.range,
    );
  }

  /** 어르신은 자기 자신의 로그만, 보호자는 연동된 어르신의 로그만 조회할 수 있다. */
  private async assertCanAccessElder(
    user: AuthUser,
    elderId: string,
  ): Promise<void> {
    if (user.role === 'ELDER') {
      if (user.id !== elderId) {
        throw new AppException(
          'FORBIDDEN',
          '본인의 기록만 조회할 수 있습니다.',
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

function resolveRangeBounds(range: 'day' | 'week'): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  if (range === 'day') {
    from.setHours(0, 0, 0, 0);
  } else {
    from.setDate(from.getDate() - 7);
  }
  return { from, to };
}

function toMedicationLog(record: MedicationLogRecord): MedicationLog {
  return {
    id: record.id,
    elderId: record.elderId,
    scheduleId: record.scheduleId,
    takenAt: record.takenAt.toISOString(),
    decision: record.decision,
    sequenceConf: record.sequenceConf,
    detections: record.detectionsJson as unknown as MedicationLog['detections'],
    actionSequence:
      record.actionSequenceJson as unknown as MedicationLog['actionSequence'],
    videoRef: record.videoRef,
    manualConfirmedBy: record.manualConfirmedBy,
    manualConfirmedAt: record.manualConfirmedAt?.toISOString() ?? null,
    deviceInfo: record.deviceInfo as Record<string, unknown> | null,
    createdAt: record.createdAt.toISOString(),
  };
}

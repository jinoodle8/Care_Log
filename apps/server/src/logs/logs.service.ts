import { Injectable } from '@nestjs/common';
import type { MedicationLog } from '@carelog/shared';
import type {
  Prisma,
  MedicationLog as MedicationLogRecord,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLogDto } from './dto/create-log.dto';
import { QueryLogsDto } from './dto/query-logs.dto';

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLogDto): Promise<MedicationLog> {
    const record = await this.prisma.medicationLog.create({
      data: {
        elderId: dto.elderId,
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
    return toMedicationLog(record);
  }

  async findMany(query: QueryLogsDto): Promise<MedicationLog[]> {
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

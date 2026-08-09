import { Injectable } from '@nestjs/common';
import type { LogStats, Role } from '@carelog/shared';
import type { MedicationLog } from '@carelog/shared';
import { calculateLogStats } from '@carelog/shared';
import type {
  Prisma,
  MedicationLog as MedicationLogRecord,
} from '@prisma/client';
import { AUDIT_ACTIONS, AuditService } from '../audit/audit.service';
import { AppException } from '../common/exceptions/app.exception';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';
import { guardianPushForDecision } from '../push/push-messages';
import { PushService } from '../push/push.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateLogDto } from './dto/create-log.dto';
import { ManualConfirmDto } from './dto/manual-confirm.dto';
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
    private readonly push: PushService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
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
    await this.notifyGuardians(log);
    return log;
  }

  /** 복약 완료(M3-05)·수동확인 요청(M3-08) 푸시. 발송 실패가 로그 생성을 되돌리지 않는다. */
  private async notifyGuardians(log: MedicationLog): Promise<void> {
    const payload = guardianPushForDecision(
      log.decision,
      await this.elderNameOf(log.elderId),
    );
    if (!payload) return;

    await this.push.sendToGuardiansOfElder(log.elderId, {
      ...payload,
      data: { ...payload.data, logId: log.id, elderId: log.elderId },
    });
  }

  private async elderNameOf(elderId: string): Promise<string> {
    const elder = await this.prisma.user.findUnique({
      where: { id: elderId },
      select: { name: true },
    });
    return elder?.name ?? '';
  }

  /**
   * 보호자가 UNCERTAIN 건을 확인/미복용으로 정리한다(PRD 4.3.5).
   * 처리 결과는 log.updated로 브로드캐스트해 다른 화면도 즉시 반영되게 한다(M3-12).
   */
  async manualConfirm(
    user: AuthUser,
    logId: string,
    dto: ManualConfirmDto,
  ): Promise<MedicationLog> {
    const existing = await this.prisma.medicationLog.findUnique({
      where: { id: logId },
    });
    if (!existing) {
      throw new AppException('LOG_NOT_FOUND', '기록을 찾을 수 없습니다.', 404);
    }
    if (user.role !== 'GUARDIAN') {
      throw new AppException(
        'FORBIDDEN',
        '보호자만 수동확인할 수 있습니다.',
        403,
      );
    }
    await this.assertCanAccessElder(user, existing.elderId);

    if (existing.decision !== 'UNCERTAIN') {
      throw new AppException(
        'LOG_NOT_CONFIRMABLE',
        '확인이 필요한 기록만 처리할 수 있습니다.',
      );
    }

    const record = await this.prisma.medicationLog.update({
      where: { id: logId },
      data: {
        decision: dto.decision,
        manualConfirmedBy: user.id,
        manualConfirmedAt: new Date(),
      },
    });

    const log = toMedicationLog(record);
    this.realtime.emitLogUpdated(log);

    // 보호자가 판정을 뒤집는 민감 액션이므로 추적을 남긴다(M4-07).
    await this.audit.record({
      action: AUDIT_ACTIONS.LOG_MANUAL_CONFIRM,
      actorId: user.id,
      actorRole: user.role,
      targetType: 'MedicationLog',
      targetId: log.id,
      detail: {
        elderId: log.elderId,
        from: 'UNCERTAIN',
        to: dto.decision,
        sequenceConf: log.sequenceConf,
        hasNote: Boolean(dto.note),
      },
    });

    return log;
  }

  /**
   * 보호자가 판정 근거 영상을 볼 수 있도록 짧게 만료되는 재생 URL을 발급한다(M4-05).
   * 버킷은 퍼블릭 차단이므로 이 서명 URL 없이는 영상에 접근할 수 없다.
   */
  async getVideoUrl(
    user: AuthUser,
    logId: string,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    const log = await this.prisma.medicationLog.findUnique({
      where: { id: logId },
      select: { elderId: true, videoRef: true },
    });
    if (!log) {
      throw new AppException('LOG_NOT_FOUND', '기록을 찾을 수 없습니다.', 404);
    }
    await this.assertCanAccessElder(user, log.elderId);

    if (!log.videoRef) {
      throw new AppException('VIDEO_NOT_FOUND', '영상이 없는 기록입니다.', 404);
    }

    const url = await this.media.presignPlayback(log.videoRef);
    if (!url) {
      throw new AppException('VIDEO_NOT_FOUND', '영상이 없는 기록입니다.', 404);
    }

    // 누가 어떤 어르신의 영상을 열람했는지 남긴다(M4-07). 서명 URL 자체는 저장하지 않는다.
    await this.audit.record({
      action: AUDIT_ACTIONS.MEDIA_PRESIGN_PLAYBACK,
      actorId: user.id,
      actorRole: user.role,
      targetType: 'MedicationLog',
      targetId: logId,
      detail: { elderId: log.elderId },
    });

    return { url, expiresInSeconds: this.media.presignExpiresInSeconds };
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

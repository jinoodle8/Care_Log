import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MISSED_GRACE_MINUTES } from '@carelog/shared';
import type { MedicationLog } from '@carelog/shared';
import { PrismaService } from '../prisma/prisma.service';
import { missedSchedulePush } from '../push/push-messages';
import { PushService } from '../push/push.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { resolveMissedSchedules, type MissedTarget } from './missed-detection';

/** 감지 창을 넉넉히 덮도록 오늘 0시부터의 로그를 본다. */
function startOfDay(now: Date): Date {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date;
}

@Injectable()
export class MissedDetectionService {
  private readonly logger = new Logger(MissedDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly realtime: RealtimeGateway,
    private readonly push: PushService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron(): Promise<void> {
    // 테스트에서는 백그라운드 실행이 다른 스펙의 데이터를 건드리므로, 감지는 detectAndRecord()를
    // 직접 호출해 검증한다.
    if (this.config.get<string>('NODE_ENV') === 'test') return;

    try {
      const detected = await this.detectAndRecord();
      if (detected.length > 0) {
        this.logger.log(`미복용 감지 ${detected.length}건`);
      }
    } catch (error) {
      // 한 번 실패해도 다음 주기에 다시 시도한다(로그가 없는 한 감지 대상은 유지됨).
      this.logger.error('미복용 감지 실패', error as Error);
    }
  }

  /**
   * 스케줄 +유예시간이 지났는데 로그가 없는 건을 찾아 MISSED 로그로 기록한다.
   * 기록된 로그 자체가 다음 주기의 중복 감지를 막아 멱등성을 보장한다.
   * 반환값은 이번 주기에 새로 감지한 건이며, 푸시 발송(M3-06)에서 사용한다.
   */
  async detectAndRecord(
    now: Date = new Date(),
    /** 특정 어르신으로 범위를 좁힌다. 운영 크론은 생략해 전체를 스캔한다. */
    elderIds?: string[],
  ): Promise<MedicationLog[]> {
    const graceMinutes = Number(
      this.config.get<string>('MISSED_GRACE_MINUTES') ?? MISSED_GRACE_MINUTES,
    );

    const schedules = await this.prisma.schedule.findMany({
      where: {
        enabled: true,
        elderId: elderIds ? { in: elderIds } : undefined,
      },
    });
    if (schedules.length === 0) return [];

    const logs = await this.prisma.medicationLog.findMany({
      where: {
        elderId: { in: schedules.map((schedule) => schedule.elderId) },
        takenAt: { gte: startOfDay(now) },
      },
      select: { elderId: true, takenAt: true },
    });

    const targets = resolveMissedSchedules({
      schedules,
      logs,
      now,
      graceMinutes,
    });

    const created: MedicationLog[] = [];
    for (const target of targets) {
      const log = await this.recordMissed(target);
      if (log) created.push(log);
    }
    return created;
  }

  /** 동시 실행이나 재시도로 중복 기록되지 않도록 스케줄+시각 조합을 한 번 더 확인한다. */
  private async recordMissed(
    target: MissedTarget,
  ): Promise<MedicationLog | null> {
    const alreadyRecorded = await this.prisma.medicationLog.findFirst({
      where: {
        elderId: target.elderId,
        scheduleId: target.scheduleId,
        decision: 'MISSED',
        takenAt: target.scheduledAt,
      },
    });
    if (alreadyRecorded) return null;

    const record = await this.prisma.medicationLog.create({
      data: {
        elderId: target.elderId,
        scheduleId: target.scheduleId,
        takenAt: target.scheduledAt,
        decision: 'MISSED',
        sequenceConf: 0,
        detectionsJson: [],
        actionSequenceJson: [],
      },
    });

    const log: MedicationLog = {
      id: record.id,
      elderId: record.elderId,
      scheduleId: record.scheduleId,
      takenAt: record.takenAt.toISOString(),
      decision: record.decision,
      sequenceConf: record.sequenceConf,
      detections: [],
      actionSequence: [],
      videoRef: record.videoRef,
      manualConfirmedBy: record.manualConfirmedBy,
      manualConfirmedAt: record.manualConfirmedAt?.toISOString() ?? null,
      deviceInfo: null,
      createdAt: record.createdAt.toISOString(),
    };

    // 보호자 화면이 새로고침 없이 미복용을 보도록 실시간으로도 알린다.
    this.realtime.emitLogCreated(log);

    // 미복용 의심 푸시(M3-06). 발송 실패는 PushService가 삼키므로 감지 기록은 유지된다.
    const elder = await this.prisma.user.findUnique({
      where: { id: target.elderId },
      select: { name: true },
    });
    const payload = missedSchedulePush(elder?.name ?? '');
    await this.push.sendToGuardiansOfElder(target.elderId, {
      ...payload,
      data: { ...payload.data, logId: log.id, elderId: target.elderId },
    });

    return log;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import type { Role } from '@carelog/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { maskAuditDetail } from './audit-mask';

/** 감사 대상 액션. 문자열을 직접 쓰지 않고 여기 모아 오타·표기 흔들림을 막는다. */
export const AUDIT_ACTIONS = {
  LOG_MANUAL_CONFIRM: 'log.manual_confirm',
  SCHEDULE_CREATE: 'schedule.create',
  SCHEDULE_UPDATE: 'schedule.update',
  SCHEDULE_DELETE: 'schedule.delete',
  MEDIA_PRESIGN_UPLOAD: 'media.presign_upload',
  MEDIA_PRESIGN_PLAYBACK: 'media.presign_playback',
  LINK_INVITE_CODE_CREATE: 'link.invite_code_create',
  LINK_REDEEM: 'link.redeem',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditEntry {
  action: AuditAction;
  actorId?: string | null;
  actorRole?: Role | null;
  targetType?: string | null;
  targetId?: string | null;
  /** 저장 전에 maskAuditDetail로 마스킹된다. */
  detail?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 민감 액션을 기록한다(M4-07).
   * 감사 기록 실패가 본래 작업을 되돌리면 안 되므로 예외를 삼키고 경고만 남긴다.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          actorId: entry.actorId ?? null,
          actorRole: entry.actorRole ?? null,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          detailJson: entry.detail
            ? (maskAuditDetail(entry.detail) as Prisma.InputJsonValue)
            : undefined,
        },
      });
    } catch (error) {
      this.logger.warn(
        `감사 로그 기록 실패 (action=${entry.action}): ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }
}

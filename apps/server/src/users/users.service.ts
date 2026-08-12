import { Injectable } from '@nestjs/common';
import type { Role, UserProfile } from '@carelog/shared';
import * as bcrypt from 'bcrypt';
import { AUDIT_ACTIONS, AuditService } from '../audit/audit.service';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const BCRYPT_ROUNDS = 10;

export interface AuthUser {
  id: string;
  role: Role;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** 내 이름·전화번호 수정(M7-01). 보낸 항목만 바뀐다. */
  async updateProfile(
    user: AuthUser,
    dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    return this.applyProfileUpdate(user, user.id, dto, {
      action: AUDIT_ACTIONS.USER_PROFILE_UPDATE,
      targetType: 'User',
    });
  }

  /**
   * 보호자가 연동된 어르신의 정보를 대신 수정한다(M7-03).
   * 어르신은 계정 정보를 직접 다루지 않는 것이 온보딩 구조의 전제다(PRD 4.2.7).
   */
  async updateElderProfile(
    user: AuthUser,
    elderId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    if (user.role !== 'GUARDIAN') {
      throw new AppException(
        'FORBIDDEN',
        '보호자만 어르신 정보를 수정할 수 있습니다.',
        403,
      );
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

    return this.applyProfileUpdate(user, elderId, dto, {
      action: AUDIT_ACTIONS.ELDER_PROFILE_UPDATE,
      targetType: 'User',
    });
  }

  /** 비밀번호 변경(M7-02). 현재 비밀번호를 반드시 확인한다. */
  async changePassword(
    user: AuthUser,
    dto: ChangePasswordDto,
  ): Promise<{ ok: true }> {
    const record = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    if (!record) {
      throw new AppException(
        'USER_NOT_FOUND',
        '사용자를 찾을 수 없습니다.',
        404,
      );
    }

    // 어르신 계정은 초대코드로 만들어져 비밀번호가 없다.
    if (!record.passwordHash) {
      throw new AppException(
        'PASSWORD_NOT_SET',
        '비밀번호를 사용하지 않는 계정입니다.',
        400,
      );
    }

    if (!(await bcrypt.compare(dto.currentPassword, record.passwordHash))) {
      throw new AppException(
        'INVALID_CREDENTIALS',
        '현재 비밀번호가 올바르지 않습니다.',
        401,
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS),
      },
    });

    // 비밀번호 값은 남기지 않는다. 언제 누가 바꿨는지만 기록한다.
    await this.audit.record({
      action: AUDIT_ACTIONS.USER_PASSWORD_CHANGE,
      actorId: user.id,
      actorRole: user.role,
      targetType: 'User',
      targetId: user.id,
    });

    return { ok: true };
  }

  private async applyProfileUpdate(
    actor: AuthUser,
    targetId: string,
    dto: UpdateProfileDto,
    audit: {
      action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
      targetType: string;
    },
  ): Promise<UserProfile> {
    if (dto.name === undefined && dto.phone === undefined) {
      throw new AppException(
        'NOTHING_TO_UPDATE',
        '변경할 내용이 없습니다.',
        400,
      );
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!target) {
      throw new AppException(
        'USER_NOT_FOUND',
        '사용자를 찾을 수 없습니다.',
        404,
      );
    }

    if (dto.phone !== undefined && dto.phone !== target.phone) {
      const taken = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (taken) {
        throw new AppException(
          'PHONE_ALREADY_REGISTERED',
          '이미 사용 중인 전화번호입니다.',
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { name: dto.name, phone: dto.phone },
    });

    await this.audit.record({
      action: audit.action,
      actorId: actor.id,
      actorRole: actor.role,
      targetType: audit.targetType,
      targetId: targetId,
      // 값 자체는 maskAuditDetail이 가린다. 무엇이 바뀌었는지만 남는다.
      detail: {
        changedFields: Object.keys(dto).filter(
          (key) => dto[key as keyof UpdateProfileDto] !== undefined,
        ),
        name: dto.name,
        phone: dto.phone,
      },
    });

    return {
      id: updated.id,
      role: updated.role,
      name: updated.name,
      phone: updated.phone,
    };
  }
}

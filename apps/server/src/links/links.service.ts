import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INVITE_CODE_EXPIRES_HOURS } from '@carelog/shared';
import type {
  AuthTokens,
  CreateInviteCodeResponse,
  UserProfile,
} from '@carelog/shared';
import { randomInt } from 'node:crypto';
import { AUDIT_ACTIONS, AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { RedeemInviteCodeDto } from './dto/redeem-invite-code.dto';

/** 사람이 읽고 불러주기 쉬운 코드를 만들기 위해 혼동되는 문자(0/O, 1/I)는 제외한다. */
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 6;
const MAX_CODE_GENERATION_ATTEMPTS = 5;

export interface RedeemResult extends AuthTokens {
  elder: UserProfile;
  linkId: string;
}

@Injectable()
export class LinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
    private readonly audit: AuditService,
  ) {}

  /** 보호자가 어르신 기기 설정용 초대코드를 발급한다(기본 24시간 유효). */
  async createInviteCode(
    guardianId: string,
  ): Promise<CreateInviteCodeResponse> {
    const expiresHours = Number(
      this.config.get<string>('INVITE_CODE_EXPIRES_HOURS') ??
        INVITE_CODE_EXPIRES_HOURS,
    );
    const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000);

    for (
      let attempt = 0;
      attempt < MAX_CODE_GENERATION_ATTEMPTS;
      attempt += 1
    ) {
      const code = generateCode();
      const existing = await this.prisma.inviteCode.findUnique({
        where: { code },
      });
      if (existing) continue;

      const created = await this.prisma.inviteCode.create({
        data: { code, guardianId, expiresAt },
      });

      // 코드 값 자체가 권한이므로 감사 로그에도 남기지 않는다(maskAuditDetail이 code를 가린다).
      await this.audit.record({
        action: AUDIT_ACTIONS.LINK_INVITE_CODE_CREATE,
        actorId: guardianId,
        actorRole: 'GUARDIAN',
        targetType: 'InviteCode',
        targetId: created.id,
        detail: { expiresAt: created.expiresAt.toISOString() },
      });

      return { code: created.code, expiresAt: created.expiresAt.toISOString() };
    }

    throw new AppException(
      'INVITE_CODE_GENERATION_FAILED',
      '초대코드를 생성하지 못했습니다. 다시 시도해 주세요.',
      500,
    );
  }

  /** 어르신 기기에서 초대코드를 입력하면 어르신 계정을 만들고 보호자와 연동한다.
   * 코드 자체가 권한이므로 별도 인증 없이 호출한다. */
  async redeem(dto: RedeemInviteCodeDto): Promise<RedeemResult> {
    const invite = await this.prisma.inviteCode.findUnique({
      where: { code: dto.code.toUpperCase() },
    });

    if (!invite) {
      throw new AppException(
        'INVITE_CODE_INVALID',
        '초대코드가 올바르지 않습니다.',
      );
    }
    if (invite.redeemedAt) {
      throw new AppException(
        'INVITE_CODE_ALREADY_REDEEMED',
        '이미 사용된 초대코드입니다.',
      );
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new AppException(
        'INVITE_CODE_EXPIRED',
        '초대코드가 만료되었습니다.',
      );
    }

    const existingElder = await this.prisma.user.findUnique({
      where: { phone: dto.elderPhone },
    });
    if (existingElder) {
      throw new AppException(
        'PHONE_ALREADY_REGISTERED',
        '이미 등록된 전화번호입니다.',
      );
    }

    const { elder, linkId } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { role: 'ELDER', name: dto.elderName, phone: dto.elderPhone },
      });
      const link = await tx.link.create({
        data: { elderId: created.id, guardianId: invite.guardianId },
      });
      await tx.inviteCode.update({
        where: { id: invite.id },
        data: { redeemedAt: new Date() },
      });

      return {
        elder: {
          id: created.id,
          role: created.role,
          name: created.name,
          phone: created.phone,
        },
        linkId: link.id,
      };
    });

    // 계정 생성 + 연동이 한 번에 일어나는 지점이라 감사 대상이다(M4-07).
    await this.audit.record({
      action: AUDIT_ACTIONS.LINK_REDEEM,
      actorId: elder.id,
      actorRole: 'ELDER',
      targetType: 'Link',
      targetId: linkId,
      detail: {
        guardianId: invite.guardianId,
        elderId: elder.id,
        elderName: elder.name,
        elderPhone: elder.phone,
      },
    });

    // 어르신 기기가 이후 로그 업로드 시 사용할 토큰을 함께 발급한다(M2-15 가드 적용 대응).
    const tokens = await this.authService.issueTokensFor(elder);
    return { elder, linkId, ...tokens };
  }

  /** 보호자에게 연동된 어르신 목록. 다중 보호자·다중 어르신을 모두 지원한다. */
  async listElders(guardianId: string): Promise<UserProfile[]> {
    const links = await this.prisma.link.findMany({
      where: { guardianId },
      include: { elder: true },
      orderBy: { createdAt: 'asc' },
    });

    return links.map((link) => ({
      id: link.elder.id,
      role: link.elder.role,
      name: link.elder.name,
      phone: link.elder.phone,
    }));
  }
}

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

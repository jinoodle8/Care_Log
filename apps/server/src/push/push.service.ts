import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { PrismaService } from '../prisma/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  /** 알림 탭 시 딥링크 등에 사용할 부가 정보 */
  data?: Record<string, unknown>;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly expo: Expo;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.expo = new Expo({
      accessToken: this.config.get<string>('EXPO_ACCESS_TOKEN'),
    });
  }

  /** 어르신에게 연동된 모든 보호자에게 발송한다(다중 보호자 지원). */
  async sendToGuardiansOfElder(
    elderId: string,
    payload: PushPayload,
  ): Promise<number> {
    const links = await this.prisma.link.findMany({
      where: { elderId },
      include: { guardian: { select: { pushToken: true } } },
    });

    const tokens = links
      .map((link) => link.guardian.pushToken)
      .filter(
        (token): token is string =>
          typeof token === 'string' && token.length > 0,
      );

    return this.send(tokens, payload);
  }

  /**
   * 유효한 Expo 푸시 토큰에만 발송한다. 토큰이 없거나 형식이 잘못된 대상은 조용히 건너뛰고,
   * 발송 실패가 호출부(로그 생성·크론)를 막지 않도록 예외를 삼킨 뒤 로깅만 한다.
   */
  async send(tokens: string[], payload: PushPayload): Promise<number> {
    const validTokens = tokens.filter((token) => Expo.isExpoPushToken(token));
    if (validTokens.length === 0) return 0;

    const messages: ExpoPushMessage[] = validTokens.map((to) => ({
      to,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data,
    }));

    let sent = 0;
    for (const chunk of this.expo.chunkPushNotifications(messages)) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        sent += tickets.filter((ticket) => ticket.status === 'ok').length;

        for (const ticket of tickets) {
          if (ticket.status === 'error') {
            this.logger.warn(`푸시 전송 실패: ${ticket.message}`);
          }
        }
      } catch (error) {
        this.logger.error('푸시 전송 중 오류', error as Error);
      }
    }
    return sent;
  }
}

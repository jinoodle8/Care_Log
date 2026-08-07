import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

interface PushTicket {
  status: 'ok' | 'error';
  message?: string;
}
interface PushMessage {
  to: string;
}

const sendPushNotificationsAsync = jest.fn<
  Promise<PushTicket[]>,
  [PushMessage[]]
>();
const chunkPushNotifications = jest.fn<PushMessage[][], [PushMessage[]]>();
const isExpoPushToken = jest.fn<boolean, [string]>();

jest.mock('expo-server-sdk', () => ({
  Expo: Object.assign(
    jest.fn().mockImplementation(() => ({
      chunkPushNotifications: (messages: PushMessage[]) =>
        chunkPushNotifications(messages),
      sendPushNotificationsAsync: (messages: PushMessage[]) =>
        sendPushNotificationsAsync(messages),
    })),
    { isExpoPushToken: (token: string) => isExpoPushToken(token) },
  ),
}));

const VALID_TOKEN = 'ExponentPushToken[valid-1]';
const OTHER_VALID_TOKEN = 'ExponentPushToken[valid-2]';

describe('PushService', () => {
  let service: PushService;
  let prisma: { link: { findMany: jest.Mock } };

  beforeEach(async () => {
    jest.clearAllMocks();
    // 기본: ExponentPushToken 형식만 유효
    isExpoPushToken.mockImplementation((token) =>
      token.startsWith('ExponentPushToken['),
    );
    chunkPushNotifications.mockImplementation((messages) => [messages]);
    sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }]);

    prisma = { link: { findMany: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    service = module.get(PushService);
  });

  it('유효한 토큰에 발송하고 성공 건수를 반환한다', async () => {
    sendPushNotificationsAsync.mockResolvedValue([
      { status: 'ok' },
      { status: 'ok' },
    ]);

    const sent = await service.send([VALID_TOKEN, OTHER_VALID_TOKEN], {
      title: '복약 완료',
      body: '어르신이 약을 드셨어요',
    });

    expect(sent).toBe(2);
    expect(sendPushNotificationsAsync).toHaveBeenCalledTimes(1);
  });

  it('유효하지 않은 토큰은 걸러낸다', async () => {
    await service.send(['not-a-token', VALID_TOKEN], { title: 't', body: 'b' });

    const sentMessages = sendPushNotificationsAsync.mock.calls[0][0];
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].to).toBe(VALID_TOKEN);
  });

  it('보낼 토큰이 없으면 Expo를 호출하지 않는다', async () => {
    const sent = await service.send([], { title: 't', body: 'b' });

    expect(sent).toBe(0);
    expect(sendPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it('Expo 호출이 실패해도 예외를 던지지 않는다', async () => {
    sendPushNotificationsAsync.mockRejectedValue(new Error('network down'));

    await expect(
      service.send([VALID_TOKEN], { title: 't', body: 'b' }),
    ).resolves.toBe(0);
  });

  it('티켓이 error면 성공 건수에 포함하지 않는다', async () => {
    sendPushNotificationsAsync.mockResolvedValue([
      { status: 'ok' },
      { status: 'error', message: 'DeviceNotRegistered' },
    ]);

    const sent = await service.send([VALID_TOKEN, OTHER_VALID_TOKEN], {
      title: 't',
      body: 'b',
    });

    expect(sent).toBe(1);
  });

  it('어르신에게 연동된 보호자들의 토큰으로 발송한다', async () => {
    prisma.link.findMany.mockResolvedValue([
      { guardian: { pushToken: VALID_TOKEN } },
      { guardian: { pushToken: OTHER_VALID_TOKEN } },
    ]);
    sendPushNotificationsAsync.mockResolvedValue([
      { status: 'ok' },
      { status: 'ok' },
    ]);

    const sent = await service.sendToGuardiansOfElder('elder-1', {
      title: 't',
      body: 'b',
    });

    expect(sent).toBe(2);
    expect(prisma.link.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { elderId: 'elder-1' } }),
    );
  });

  it('푸시 토큰이 없는 보호자는 건너뛴다', async () => {
    prisma.link.findMany.mockResolvedValue([
      { guardian: { pushToken: null } },
      { guardian: { pushToken: VALID_TOKEN } },
    ]);

    await service.sendToGuardiansOfElder('elder-1', { title: 't', body: 'b' });

    const sentMessages = sendPushNotificationsAsync.mock.calls[0][0];
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].to).toBe(VALID_TOKEN);
  });

  it('연동된 보호자가 아무도 토큰이 없으면 발송하지 않는다', async () => {
    prisma.link.findMany.mockResolvedValue([{ guardian: { pushToken: null } }]);

    const sent = await service.sendToGuardiansOfElder('elder-1', {
      title: 't',
      body: 'b',
    });

    expect(sent).toBe(0);
    expect(sendPushNotificationsAsync).not.toHaveBeenCalled();
  });
});

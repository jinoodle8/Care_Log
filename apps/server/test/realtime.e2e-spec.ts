import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { MedicationLog } from '@carelog/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { PrismaService } from './../src/prisma/prisma.service';
import { uniquePhoneSuffix } from './test-ids';

interface AuthResponse {
  accessToken: string;
  user: { id: string };
}

interface RedeemResponse {
  accessToken: string;
  elder: { id: string };
}

const SOCKET_TIMEOUT_MS = 5000;

interface SubscribeAck {
  ok: boolean;
  code?: string;
}

/** emitWithAck는 any를 반환하므로 서버 계약 타입으로 좁혀서 쓴다. */
async function subscribeAck(
  socket: Socket,
  elderId: string,
): Promise<SubscribeAck> {
  return (await socket.emitWithAck('subscribe', { elderId })) as SubscribeAck;
}

describe('RealtimeGateway (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let baseUrl: string;

  const suffix = uniquePhoneSuffix();
  const guardianPhone = `010${suffix}`;
  const elderPhone = `011${suffix}`;
  const otherGuardianPhone = `012${suffix}`;
  const password = 'test-password-1234';

  let guardianToken: string;
  let guardianId: string;
  let elderToken: string;
  let elderId: string;
  let otherGuardianToken: string;

  const openSockets: Socket[] = [];

  function connect(token?: string): Socket {
    const socket = io(`${baseUrl}/realtime`, {
      transports: ['websocket'],
      auth: token ? { token } : {},
      reconnection: false,
    });
    openSockets.push(socket);
    return socket;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    await app.listen(0);
    baseUrl = await app.getUrl();
    prisma = app.get(PrismaService);

    const guardianRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: '실시간 보호자', phone: guardianPhone, password })
      .expect(201);
    guardianToken = (guardianRes.body as AuthResponse).accessToken;
    guardianId = (guardianRes.body as AuthResponse).user.id;

    const codeRes = await request(app.getHttpServer())
      .post('/links/invite-code')
      .set('Authorization', `Bearer ${guardianToken}`)
      .expect(201);

    const redeemRes = await request(app.getHttpServer())
      .post('/links/redeem')
      .send({
        code: (codeRes.body as { code: string }).code,
        elderName: '실시간 어르신',
        elderPhone,
      })
      .expect(201);
    elderToken = (redeemRes.body as RedeemResponse).accessToken;
    elderId = (redeemRes.body as RedeemResponse).elder.id;

    const otherRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: '무관한 보호자', phone: otherGuardianPhone, password })
      .expect(201);
    otherGuardianToken = (otherRes.body as AuthResponse).accessToken;
  }, 30000);

  afterEach(() => {
    while (openSockets.length > 0) {
      openSockets.pop()?.disconnect();
    }
  });

  afterAll(async () => {
    await prisma.medicationLog.deleteMany({ where: { elderId } });
    await prisma.link.deleteMany({ where: { guardianId } });
    await prisma.inviteCode.deleteMany({ where: { guardianId } });
    await prisma.user.deleteMany({
      where: { phone: { in: [guardianPhone, elderPhone, otherGuardianPhone] } },
    });
    await app.close();
  });

  it('토큰 없이 연결하면 서버가 연결을 끊는다', async () => {
    const socket = connect();

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('disconnect 되지 않음')),
        SOCKET_TIMEOUT_MS,
      );
      socket.on('disconnect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.on('connect_error', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }, 10000);

  it('연동된 보호자는 어르신 room을 구독할 수 있다', async () => {
    const socket = connect(guardianToken);
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));

    const ack = await subscribeAck(socket, elderId);
    expect(ack).toEqual({ ok: true });
  }, 10000);

  it('연동되지 않은 보호자는 구독이 거부된다', async () => {
    const socket = connect(otherGuardianToken);
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));

    const ack = await subscribeAck(socket, elderId);
    expect(ack).toEqual({ ok: false, code: 'NOT_LINKED_ELDER' });
  }, 10000);

  it('구독한 보호자는 로그 생성 시 log.created 이벤트를 받는다', async () => {
    const socket = connect(guardianToken);
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    await subscribeAck(socket, elderId);

    const received = new Promise<MedicationLog>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('log.created 이벤트를 받지 못함')),
        SOCKET_TIMEOUT_MS,
      );
      socket.on('log.created', (log: MedicationLog) => {
        clearTimeout(timer);
        resolve(log);
      });
    });

    await request(app.getHttpServer())
      .post('/logs')
      .set('Authorization', `Bearer ${elderToken}`)
      .send({
        takenAt: new Date().toISOString(),
        decision: 'TAKEN',
        sequenceConf: 0.96,
        detections: [{ cls: 'face', conf: 0.95, bbox: [0.4, 0.4, 0.6, 0.6] }],
        actionSequence: ['pick_up', 'hand_to_mouth', 'swallow', 'drink_water'],
      })
      .expect(201);

    const log = await received;
    expect(log.elderId).toBe(elderId);
    expect(log.decision).toBe('TAKEN');
  }, 15000);
});

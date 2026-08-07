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

describe('수동확인 (e2e)', () => {
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
      .send({ name: '확인 보호자', phone: guardianPhone, password })
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
        elderName: '확인 어르신',
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

  beforeEach(async () => {
    await prisma.medicationLog.deleteMany({ where: { elderId } });
  });

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

  async function createLog(decision: string): Promise<MedicationLog> {
    const res = await request(app.getHttpServer())
      .post('/logs')
      .set('Authorization', `Bearer ${elderToken}`)
      .send({
        takenAt: new Date().toISOString(),
        decision,
        sequenceConf: decision === 'UNCERTAIN' ? 0.72 : 0.96,
        detections: [{ cls: 'face', conf: 0.95, bbox: [0.4, 0.4, 0.6, 0.6] }],
        actionSequence: ['pick_up', 'hand_to_mouth'],
      })
      .expect(201);
    return res.body as MedicationLog;
  }

  it('UNCERTAIN 건을 복약 확인(TAKEN)으로 처리한다', async () => {
    const log = await createLog('UNCERTAIN');

    const res = await request(app.getHttpServer())
      .patch(`/logs/${log.id}/manual-confirm`)
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({ decision: 'TAKEN' })
      .expect(200);

    const body = res.body as MedicationLog;
    expect(body.decision).toBe('TAKEN');
    expect(body.manualConfirmedBy).toBe(guardianId);
    expect(body.manualConfirmedAt).toEqual(expect.any(String));
  });

  it('UNCERTAIN 건을 미복용(MISSED)으로 처리한다', async () => {
    const log = await createLog('UNCERTAIN');

    const res = await request(app.getHttpServer())
      .patch(`/logs/${log.id}/manual-confirm`)
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({ decision: 'MISSED', note: '전화로 확인함' })
      .expect(200);

    expect((res.body as MedicationLog).decision).toBe('MISSED');
  });

  it('UNCERTAIN이 아닌 건은 처리할 수 없다', async () => {
    const log = await createLog('TAKEN');

    const res = await request(app.getHttpServer())
      .patch(`/logs/${log.id}/manual-confirm`)
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({ decision: 'MISSED' })
      .expect(400);

    expect((res.body as { code: string }).code).toBe('LOG_NOT_CONFIRMABLE');
  });

  it('UNCERTAIN 외의 decision 값은 거부한다', async () => {
    const log = await createLog('UNCERTAIN');

    await request(app.getHttpServer())
      .patch(`/logs/${log.id}/manual-confirm`)
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({ decision: 'UNCERTAIN' })
      .expect(400);
  });

  it('어르신 본인은 수동확인할 수 없다', async () => {
    const log = await createLog('UNCERTAIN');

    const res = await request(app.getHttpServer())
      .patch(`/logs/${log.id}/manual-confirm`)
      .set('Authorization', `Bearer ${elderToken}`)
      .send({ decision: 'TAKEN' })
      .expect(403);

    expect((res.body as { code: string }).code).toBe('FORBIDDEN');
  });

  it('연동되지 않은 보호자는 처리할 수 없다', async () => {
    const log = await createLog('UNCERTAIN');

    const res = await request(app.getHttpServer())
      .patch(`/logs/${log.id}/manual-confirm`)
      .set('Authorization', `Bearer ${otherGuardianToken}`)
      .send({ decision: 'TAKEN' })
      .expect(403);

    expect((res.body as { code: string }).code).toBe('NOT_LINKED_ELDER');
  });

  it('존재하지 않는 로그는 404를 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .patch('/logs/no-such-id/manual-confirm')
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({ decision: 'TAKEN' })
      .expect(404);

    expect((res.body as { code: string }).code).toBe('LOG_NOT_FOUND');
  });

  it('토큰 없이 호출하면 401을 반환한다', async () => {
    const log = await createLog('UNCERTAIN');

    await request(app.getHttpServer())
      .patch(`/logs/${log.id}/manual-confirm`)
      .send({ decision: 'TAKEN' })
      .expect(401);
  });

  it('수동확인 시 구독 중인 보호자에게 log.updated를 보낸다 (M3-12)', async () => {
    const log = await createLog('UNCERTAIN');

    const socket = io(`${baseUrl}/realtime`, {
      transports: ['websocket'],
      auth: { token: guardianToken },
      reconnection: false,
    });
    openSockets.push(socket);

    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    await socket.emitWithAck('subscribe', { elderId });

    const received = new Promise<MedicationLog>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('log.updated 이벤트를 받지 못함')),
        SOCKET_TIMEOUT_MS,
      );
      socket.on('log.updated', (updated: MedicationLog) => {
        clearTimeout(timer);
        resolve(updated);
      });
    });

    await request(app.getHttpServer())
      .patch(`/logs/${log.id}/manual-confirm`)
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({ decision: 'TAKEN' })
      .expect(200);

    const updated = await received;
    expect(updated.id).toBe(log.id);
    expect(updated.decision).toBe('TAKEN');
  }, 15000);
});

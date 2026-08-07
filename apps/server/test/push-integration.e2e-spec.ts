import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { PrismaService } from './../src/prisma/prisma.service';
import { PushService, type PushPayload } from './../src/push/push.service';
import { MissedDetectionService } from './../src/schedules/missed-detection.service';
import { uniquePhoneSuffix } from './test-ids';

interface AuthResponse {
  accessToken: string;
  user: { id: string };
}

interface RedeemResponse {
  accessToken: string;
  elder: { id: string };
}

function at(hours: number, minutes = 0): Date {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

describe('푸시 연동 (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let missedDetection: MissedDetectionService;

  /** 실제 Expo 호출 대신 발송 요청을 가로채 기록한다. */
  const sentPushes: { elderId: string; payload: PushPayload }[] = [];

  const suffix = uniquePhoneSuffix();
  const guardianPhone = `010${suffix}`;
  const elderPhone = `011${suffix}`;
  const password = 'test-password-1234';

  let guardianToken: string;
  let guardianId: string;
  let elderToken: string;
  let elderId: string;

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
    prisma = app.get(PrismaService);
    missedDetection = app.get(MissedDetectionService);

    const pushService = app.get(PushService);
    jest
      .spyOn(pushService, 'sendToGuardiansOfElder')
      .mockImplementation((targetElderId: string, payload: PushPayload) => {
        sentPushes.push({ elderId: targetElderId, payload });
        return Promise.resolve(1);
      });

    const guardianRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: '푸시 보호자', phone: guardianPhone, password })
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
        elderName: '푸시 어르신',
        elderPhone,
      })
      .expect(201);
    elderToken = (redeemRes.body as RedeemResponse).accessToken;
    elderId = (redeemRes.body as RedeemResponse).elder.id;
  }, 30000);

  beforeEach(async () => {
    sentPushes.length = 0;
    await prisma.medicationLog.deleteMany({ where: { elderId } });
    await prisma.schedule.deleteMany({ where: { elderId } });
  });

  afterAll(async () => {
    await prisma.medicationLog.deleteMany({ where: { elderId } });
    await prisma.schedule.deleteMany({ where: { elderId } });
    await prisma.link.deleteMany({ where: { guardianId } });
    await prisma.inviteCode.deleteMany({ where: { guardianId } });
    await prisma.user.deleteMany({
      where: { phone: { in: [guardianPhone, elderPhone] } },
    });
    await app.close();
  });

  /** 다른 스펙이 병렬로 유발한 발송을 걸러낸다. */
  function myPushes() {
    return sentPushes.filter((push) => push.elderId === elderId);
  }

  async function postLog(decision: string) {
    return request(app.getHttpServer())
      .post('/logs')
      .set('Authorization', `Bearer ${elderToken}`)
      .send({
        takenAt: new Date().toISOString(),
        decision,
        sequenceConf: decision === 'TAKEN' ? 0.96 : 0.72,
        detections: [{ cls: 'face', conf: 0.95, bbox: [0.4, 0.4, 0.6, 0.6] }],
        actionSequence: ['pick_up', 'hand_to_mouth'],
      })
      .expect(201);
  }

  it('TAKEN 로그를 올리면 복약 완료 푸시를 보낸다 (M3-05)', async () => {
    await postLog('TAKEN');

    const pushes = myPushes();
    expect(pushes).toHaveLength(1);
    expect(pushes[0].payload.title).toBe('복약 완료');
    expect(pushes[0].payload.data).toMatchObject({
      type: 'log.taken',
      elderId,
    });
  });

  it('UNCERTAIN 로그를 올리면 수동확인 요청 푸시를 보낸다 (M3-08)', async () => {
    await postLog('UNCERTAIN');

    const pushes = myPushes();
    expect(pushes).toHaveLength(1);
    expect(pushes[0].payload.title).toBe('확인이 필요해요');
    expect(pushes[0].payload.data).toMatchObject({ type: 'log.uncertain' });
  });

  it('어르신이 직접 올린 MISSED 로그로는 푸시를 보내지 않는다', async () => {
    await postLog('MISSED');

    expect(myPushes()).toHaveLength(0);
  });

  it('미복용 감지 시 미복용 푸시를 보낸다 (M3-06)', async () => {
    await request(app.getHttpServer())
      .post('/schedules')
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({ elderId, slot: 'MORNING', time: '08:00' })
      .expect(201);

    await missedDetection.detectAndRecord(at(9), [elderId]);

    const pushes = myPushes();
    expect(pushes).toHaveLength(1);
    expect(pushes[0].payload.title).toBe('복약 기록이 없어요');
    expect(pushes[0].payload.data).toMatchObject({ type: 'schedule.missed' });
  });

  it('푸시 토큰을 등록할 수 있다', async () => {
    await request(app.getHttpServer())
      .post('/users/me/push-token')
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({ pushToken: 'ExponentPushToken[test-token]' })
      .expect(200);

    const guardian = await prisma.user.findUnique({
      where: { id: guardianId },
    });
    expect(guardian?.pushToken).toBe('ExponentPushToken[test-token]');
  });
});

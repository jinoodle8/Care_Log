import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
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

describe('LogsController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

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

    // 보호자 가입 → 초대코드 발급 → 어르신 연동(어르신 토큰 확보)
    const guardianRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: '로그 테스트 보호자', phone: guardianPhone, password })
      .expect(201);
    guardianToken = (guardianRes.body as AuthResponse).accessToken;
    guardianId = (guardianRes.body as AuthResponse).user.id;

    const codeRes = await request(app.getHttpServer())
      .post('/links/invite-code')
      .set('Authorization', `Bearer ${guardianToken}`)
      .expect(201);
    const { code } = codeRes.body as { code: string };

    const redeemRes = await request(app.getHttpServer())
      .post('/links/redeem')
      .send({ code, elderName: '로그 테스트 어르신', elderPhone })
      .expect(201);
    elderToken = (redeemRes.body as RedeemResponse).accessToken;
    elderId = (redeemRes.body as RedeemResponse).elder.id;

    const otherRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: '무관한 보호자', phone: otherGuardianPhone, password })
      .expect(201);
    otherGuardianToken = (otherRes.body as AuthResponse).accessToken;
  }, 30000);

  afterAll(async () => {
    await prisma.medicationLog.deleteMany({ where: { elderId } });
    await prisma.link.deleteMany({ where: { guardianId } });
    await prisma.inviteCode.deleteMany({ where: { guardianId } });
    await prisma.user.deleteMany({
      where: { phone: { in: [guardianPhone, elderPhone, otherGuardianPhone] } },
    });
    await app.close();
  });

  function buildCreateLogPayload(
    overrides: Partial<Record<string, unknown>> = {},
  ) {
    return {
      takenAt: new Date().toISOString(),
      decision: 'TAKEN',
      sequenceConf: 0.94,
      detections: [
        { cls: 'face', conf: 0.97, bbox: [0.4, 0.4, 0.6, 0.6] },
        { cls: 'pill', conf: 0.93, bbox: [0.45, 0.5, 0.55, 0.58] },
        { cls: 'hand', conf: 0.95, bbox: [0.42, 0.48, 0.6, 0.65] },
      ],
      actionSequence: ['pick_up', 'hand_to_mouth', 'swallow', 'drink_water'],
      ...overrides,
    };
  }

  it('어르신 토큰으로 POST /logs 하면 토큰의 elderId로 로그를 생성한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/logs')
      .set('Authorization', `Bearer ${elderToken}`)
      .send(buildCreateLogPayload())
      .expect(201);

    const body = res.body as { id: string; elderId: string; decision: string };
    expect(body.id).toEqual(expect.any(String));
    expect(body.elderId).toBe(elderId);
    expect(body.decision).toBe('TAKEN');
  });

  it('토큰 없이 POST /logs 하면 401을 반환한다', async () => {
    await request(app.getHttpServer())
      .post('/logs')
      .send(buildCreateLogPayload())
      .expect(401);
  });

  it('보호자 토큰으로 POST /logs 하면 403을 반환한다', async () => {
    await request(app.getHttpServer())
      .post('/logs')
      .set('Authorization', `Bearer ${guardianToken}`)
      .send(buildCreateLogPayload())
      .expect(403);
  });

  it('연동된 보호자는 GET /logs로 어르신 로그를 조회할 수 있다', async () => {
    await request(app.getHttpServer())
      .post('/logs')
      .set('Authorization', `Bearer ${elderToken}`)
      .send(
        buildCreateLogPayload({ decision: 'UNCERTAIN', sequenceConf: 0.75 }),
      )
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/logs')
      .query({ elderId })
      .set('Authorization', `Bearer ${guardianToken}`)
      .expect(200);

    const body = res.body as Array<{ elderId: string; decision: string }>;
    expect(body.some((log) => log.decision === 'UNCERTAIN')).toBe(true);
    expect(body.every((log) => log.elderId === elderId)).toBe(true);
  });

  it('연동되지 않은 보호자가 GET /logs 하면 NOT_LINKED_ELDER 403을 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .get('/logs')
      .query({ elderId })
      .set('Authorization', `Bearer ${otherGuardianToken}`)
      .expect(403);

    expect((res.body as { code: string }).code).toBe('NOT_LINKED_ELDER');
  });

  it('토큰 없이 GET /logs 하면 401을 반환한다', async () => {
    await request(app.getHttpServer())
      .get('/logs')
      .query({ elderId })
      .expect(401);
  });

  it('decision 필터가 정상 동작한다', async () => {
    const res = await request(app.getHttpServer())
      .get('/logs')
      .query({ elderId, decision: 'MISSED' })
      .set('Authorization', `Bearer ${guardianToken}`)
      .expect(200);

    const body = res.body as Array<{ decision: string }>;
    expect(body.every((log) => log.decision === 'MISSED')).toBe(true);
  });

  it('잘못된 decision 값으로 POST /logs 하면 400을 반환한다', async () => {
    await request(app.getHttpServer())
      .post('/logs')
      .set('Authorization', `Bearer ${elderToken}`)
      .send(buildCreateLogPayload({ decision: 'INVALID' }))
      .expect(400);
  });

  it('elderId 없이 GET /logs 하면 400을 반환한다', async () => {
    await request(app.getHttpServer())
      .get('/logs')
      .set('Authorization', `Bearer ${guardianToken}`)
      .expect(400);
  });

  describe('GET /logs/stats', () => {
    it('스케줄(로그) 4건 중 TAKEN 3건이면 이행률 75%를 반환한다', async () => {
      await prisma.medicationLog.deleteMany({ where: { elderId } });

      for (const decision of ['TAKEN', 'TAKEN', 'TAKEN', 'UNCERTAIN']) {
        await request(app.getHttpServer())
          .post('/logs')
          .set('Authorization', `Bearer ${elderToken}`)
          .send(buildCreateLogPayload({ decision }))
          .expect(201);
      }

      const res = await request(app.getHttpServer())
        .get('/logs/stats')
        .query({ elderId, range: 'day' })
        .set('Authorization', `Bearer ${guardianToken}`)
        .expect(200);

      expect(res.body).toEqual({
        range: 'day',
        takenCount: 3,
        uncertainCount: 1,
        missedCount: 0,
        scheduledCount: 4,
        adherenceRate: 0.75,
      });
    }, 30000);

    it('range 값이 잘못되면 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .get('/logs/stats')
        .query({ elderId, range: 'month' })
        .set('Authorization', `Bearer ${guardianToken}`)
        .expect(400);
    });

    it('토큰 없이 호출하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .get('/logs/stats')
        .query({ elderId, range: 'day' })
        .expect(401);
    });
  });
});

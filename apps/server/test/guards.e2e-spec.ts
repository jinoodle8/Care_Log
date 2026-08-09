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

/**
 * M4-06 가드 점검 체크리스트를 실행 가능한 형태로 고정한다.
 * 인증은 전역 기본값(fail-closed)이고, 역할 제한은 @Roles로만 완화/강화된다.
 */
describe('인증·역할 가드 (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = uniquePhoneSuffix();
  const guardianPhone = `010${suffix}`;
  const elderPhone = `011${suffix}`;
  const password = 'test-password-1234';

  let guardianToken: string;
  let guardianId: string;
  let elderToken: string;
  let elderId: string;
  let scheduleId: string;

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

    const guardianRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: '가드 보호자', phone: guardianPhone, password })
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
        elderName: '가드 어르신',
        elderPhone,
      })
      .expect(201);
    elderToken = (redeemRes.body as RedeemResponse).accessToken;
    elderId = (redeemRes.body as RedeemResponse).elder.id;

    const scheduleRes = await request(app.getHttpServer())
      .post('/schedules')
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({ elderId, slot: 'MORNING', time: '08:00' })
      .expect(201);
    scheduleId = (scheduleRes.body as { id: string }).id;
  }, 30000);

  afterAll(async () => {
    await prisma.schedule.deleteMany({ where: { elderId } });
    await prisma.medicationLog.deleteMany({ where: { elderId } });
    await prisma.link.deleteMany({ where: { guardianId } });
    await prisma.inviteCode.deleteMany({ where: { guardianId } });
    await prisma.user.deleteMany({
      where: { phone: { in: [guardianPhone, elderPhone] } },
    });
    await app.close();
  });

  describe('인증 기본값 (fail-closed)', () => {
    it('헬스체크는 인증 없이 열려 있다', async () => {
      await request(app.getHttpServer()).get('/').expect(200);
    });

    it.each([
      ['get', '/users/me'],
      ['get', '/users/me/elders'],
      ['post', '/links/invite-code'],
      ['post', '/logs'],
      ['get', '/logs'],
      ['get', '/logs/stats'],
      ['post', '/media/presign'],
      ['get', '/schedules'],
      ['post', '/schedules'],
      ['post', '/users/me/push-token'],
    ] as const)(
      '%s %s 는 토큰 없이 호출하면 401을 반환한다',
      async (method, path) => {
        await request(app.getHttpServer())[method](path).expect(401);
      },
    );
  });

  describe('보호자 전용 라우트', () => {
    it('어르신 토큰으로는 초대코드를 만들 수 없다', async () => {
      const res = await request(app.getHttpServer())
        .post('/links/invite-code')
        .set('Authorization', `Bearer ${elderToken}`)
        .expect(403);
      expect((res.body as { code: string }).code).toBe('FORBIDDEN');
    });

    it('어르신 토큰으로는 연동된 어르신 목록을 볼 수 없다', async () => {
      await request(app.getHttpServer())
        .get('/users/me/elders')
        .set('Authorization', `Bearer ${elderToken}`)
        .expect(403);
    });

    it('어르신 토큰으로는 스케줄을 만들 수 없다', async () => {
      await request(app.getHttpServer())
        .post('/schedules')
        .set('Authorization', `Bearer ${elderToken}`)
        .send({ elderId, slot: 'NOON', time: '12:00' })
        .expect(403);
    });

    it('어르신 토큰으로는 스케줄을 수정·삭제할 수 없다', async () => {
      await request(app.getHttpServer())
        .patch(`/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${elderToken}`)
        .send({ time: '09:00' })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${elderToken}`)
        .expect(403);
    });
  });

  describe('어르신 전용 라우트', () => {
    it('보호자 토큰으로는 영상 presign을 받을 수 없다', async () => {
      await request(app.getHttpServer())
        .post('/media/presign')
        .set('Authorization', `Bearer ${guardianToken}`)
        .send({ contentType: 'video/mp4' })
        .expect(403);
    });

    it('보호자 토큰으로는 복약 로그를 올릴 수 없다', async () => {
      await request(app.getHttpServer())
        .post('/logs')
        .set('Authorization', `Bearer ${guardianToken}`)
        .send({
          takenAt: new Date().toISOString(),
          decision: 'TAKEN',
          sequenceConf: 0.95,
          detections: [{ cls: 'face', conf: 0.9, bbox: [0.4, 0.4, 0.6, 0.6] }],
          actionSequence: ['pick_up'],
        })
        .expect(403);
    });
  });

  describe('두 역할 모두 허용되는 라우트', () => {
    it('어르신도 자기 스케줄은 조회할 수 있다 (로컬 알림 동기화)', async () => {
      const res = await request(app.getHttpServer())
        .get('/schedules')
        .query({ elderId })
        .set('Authorization', `Bearer ${elderToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('양쪽 모두 자기 정보를 조회할 수 있다', async () => {
      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${elderToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${guardianToken}`)
        .expect(200);
    });
  });

  it('위조된 토큰은 401을 반환한다', async () => {
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });
});

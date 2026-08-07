import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { PrismaService } from './../src/prisma/prisma.service';

interface AuthResponse {
  accessToken: string;
  user: { id: string };
}

interface RedeemResponse {
  accessToken: string;
  elder: { id: string };
}

interface ScheduleResponse {
  id: string;
  elderId: string;
  slot: string;
  time: string;
  enabled: boolean;
}

describe('SchedulesController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = String(Date.now()).slice(-8);
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

    const guardianRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: '스케줄 보호자', phone: guardianPhone, password })
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
        elderName: '스케줄 어르신',
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

  afterAll(async () => {
    await prisma.medicationLog.deleteMany({ where: { elderId } });
    await prisma.schedule.deleteMany({ where: { elderId } });
    await prisma.link.deleteMany({ where: { guardianId } });
    await prisma.inviteCode.deleteMany({ where: { guardianId } });
    await prisma.user.deleteMany({
      where: { phone: { in: [guardianPhone, elderPhone, otherGuardianPhone] } },
    });
    await app.close();
  });

  it('보호자가 어르신 스케줄을 생성한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/schedules')
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({ elderId, slot: 'MORNING', time: '08:30' })
      .expect(201);

    const body = res.body as ScheduleResponse;
    expect(body).toMatchObject({
      elderId,
      slot: 'MORNING',
      time: '08:30',
      enabled: true,
    });
  });

  it('동일 슬롯을 중복 생성하면 SCHEDULE_SLOT_DUPLICATE를 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/schedules')
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({ elderId, slot: 'MORNING', time: '09:00' })
      .expect(400);

    expect((res.body as { code: string }).code).toBe('SCHEDULE_SLOT_DUPLICATE');
  });

  it('잘못된 time 형식이면 400을 반환한다', async () => {
    await request(app.getHttpServer())
      .post('/schedules')
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({ elderId, slot: 'NOON', time: '25:00' })
      .expect(400);
  });

  it('GET /schedules로 어르신 스케줄 목록을 조회한다', async () => {
    await request(app.getHttpServer())
      .post('/schedules')
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({ elderId, slot: 'EVENING', time: '19:00' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/schedules')
      .query({ elderId })
      .set('Authorization', `Bearer ${guardianToken}`)
      .expect(200);

    const body = res.body as ScheduleResponse[];
    expect(body.map((item) => item.slot).sort()).toEqual([
      'EVENING',
      'MORNING',
    ]);
  });

  it('어르신 본인도 자기 스케줄을 조회할 수 있다', async () => {
    const res = await request(app.getHttpServer())
      .get('/schedules')
      .query({ elderId })
      .set('Authorization', `Bearer ${elderToken}`)
      .expect(200);

    expect((res.body as ScheduleResponse[]).length).toBeGreaterThan(0);
  });

  it('PATCH로 시각과 on/off를 수정한다', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/schedules')
      .query({ elderId })
      .set('Authorization', `Bearer ${guardianToken}`)
      .expect(200);
    const target = (listRes.body as ScheduleResponse[]).find(
      (s) => s.slot === 'MORNING',
    )!;

    const res = await request(app.getHttpServer())
      .patch(`/schedules/${target.id}`)
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({ time: '07:45', enabled: false })
      .expect(200);

    expect(res.body).toMatchObject({
      id: target.id,
      time: '07:45',
      enabled: false,
    });
  });

  it('DELETE로 스케줄을 삭제한다', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/schedules')
      .query({ elderId })
      .set('Authorization', `Bearer ${guardianToken}`)
      .expect(200);
    const target = (listRes.body as ScheduleResponse[]).find(
      (s) => s.slot === 'EVENING',
    )!;

    await request(app.getHttpServer())
      .delete(`/schedules/${target.id}`)
      .set('Authorization', `Bearer ${guardianToken}`)
      .expect(200);

    const afterRes = await request(app.getHttpServer())
      .get('/schedules')
      .query({ elderId })
      .set('Authorization', `Bearer ${guardianToken}`)
      .expect(200);
    expect(
      (afterRes.body as ScheduleResponse[]).some((s) => s.id === target.id),
    ).toBe(false);
  });

  it('연동되지 않은 보호자는 NOT_LINKED_ELDER 403을 받는다', async () => {
    const res = await request(app.getHttpServer())
      .get('/schedules')
      .query({ elderId })
      .set('Authorization', `Bearer ${otherGuardianToken}`)
      .expect(403);

    expect((res.body as { code: string }).code).toBe('NOT_LINKED_ELDER');
  });

  it('토큰 없이 호출하면 401을 반환한다', async () => {
    await request(app.getHttpServer())
      .get('/schedules')
      .query({ elderId })
      .expect(401);
  });

  it('존재하지 않는 스케줄을 수정하면 404를 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .patch('/schedules/no-such-id')
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({ time: '10:00' })
      .expect(404);

    expect((res.body as { code: string }).code).toBe('SCHEDULE_NOT_FOUND');
  });
});

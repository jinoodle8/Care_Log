import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { PrismaService } from './../src/prisma/prisma.service';
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

/** 오늘 날짜의 특정 시각 */
function at(hours: number, minutes = 0): Date {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

describe('MissedDetectionService (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let service: MissedDetectionService;

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
    service = app.get(MissedDetectionService);

    const guardianRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: '크론 보호자', phone: guardianPhone, password })
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
        elderName: '크론 어르신',
        elderPhone,
      })
      .expect(201);
    elderToken = (redeemRes.body as RedeemResponse).accessToken;
    elderId = (redeemRes.body as RedeemResponse).elder.id;
  }, 30000);

  beforeEach(async () => {
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

  /** detectAndRecord는 전체 스케줄을 스캔하므로, 병렬로 도는 다른 스펙의 결과를 걸러낸다. */
  function mine<T extends { elderId: string }>(logs: T[]): T[] {
    return logs.filter((log) => log.elderId === elderId);
  }

  async function createSchedule(time: string, enabled = true) {
    return request(app.getHttpServer())
      .post('/schedules')
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({ elderId, slot: 'MORNING', time, enabled })
      .expect(201);
  }

  it('유예 시간이 지나고 로그가 없으면 MISSED 로그를 만든다', async () => {
    await createSchedule('08:00');

    const created = mine(await service.detectAndRecord(at(9), [elderId]));

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      elderId,
      decision: 'MISSED',
      sequenceConf: 0,
    });

    const stored = await prisma.medicationLog.findMany({ where: { elderId } });
    expect(stored).toHaveLength(1);
    expect(stored[0].decision).toBe('MISSED');
  });

  it('두 번 돌려도 중복 기록하지 않는다(멱등)', async () => {
    await createSchedule('08:00');

    const first = mine(await service.detectAndRecord(at(9), [elderId]));
    const second = mine(await service.detectAndRecord(at(9), [elderId]));

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);

    const stored = await prisma.medicationLog.findMany({ where: { elderId } });
    expect(stored).toHaveLength(1);
  });

  it('유예 시간 전에는 감지하지 않는다', async () => {
    await createSchedule('08:00');

    const created = mine(await service.detectAndRecord(at(8, 20), [elderId]));

    expect(created).toHaveLength(0);
    expect(await prisma.medicationLog.count({ where: { elderId } })).toBe(0);
  });

  it('해당 시간대에 복약 로그가 있으면 감지하지 않는다', async () => {
    await createSchedule('08:00');
    await request(app.getHttpServer())
      .post('/logs')
      .set('Authorization', `Bearer ${elderToken}`)
      .send({
        takenAt: at(8, 10).toISOString(),
        decision: 'TAKEN',
        sequenceConf: 0.96,
        detections: [{ cls: 'face', conf: 0.95, bbox: [0.4, 0.4, 0.6, 0.6] }],
        actionSequence: ['pick_up', 'hand_to_mouth', 'swallow', 'drink_water'],
      })
      .expect(201);

    const created = mine(await service.detectAndRecord(at(9), [elderId]));

    expect(created).toHaveLength(0);
    expect(
      await prisma.medicationLog.count({
        where: { elderId, decision: 'MISSED' },
      }),
    ).toBe(0);
  });

  it('비활성 스케줄은 감지하지 않는다', async () => {
    await createSchedule('08:00', false);

    const created = mine(await service.detectAndRecord(at(9), [elderId]));

    expect(created).toHaveLength(0);
  });

  it('감지된 MISSED 로그는 보호자 조회에도 나타난다', async () => {
    await createSchedule('08:00');
    await service.detectAndRecord(at(9), [elderId]);

    const res = await request(app.getHttpServer())
      .get('/logs')
      .query({ elderId, decision: 'MISSED' })
      .set('Authorization', `Bearer ${guardianToken}`)
      .expect(200);

    expect((res.body as unknown[]).length).toBe(1);
  });
});

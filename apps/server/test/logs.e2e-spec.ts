import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { PrismaService } from './../src/prisma/prisma.service';

describe('LogsController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
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
    const elder = await prisma.user.create({
      data: {
        role: 'ELDER',
        name: '테스트 어르신',
        phone: `010-e2e-${Date.now()}`,
      },
    });
    elderId = elder.id;
  }, 30000);

  afterAll(async () => {
    await prisma.medicationLog.deleteMany({ where: { elderId } });
    await prisma.user.delete({ where: { id: elderId } });
    await app.close();
  });

  function buildCreateLogPayload(
    overrides: Partial<Record<string, unknown>> = {},
  ) {
    return {
      elderId,
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

  it('POST /logs로 로그를 생성하면 201과 함께 생성된 로그를 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/logs')
      .send(buildCreateLogPayload())
      .expect(201);

    const body = res.body as { id: string; elderId: string; decision: string };
    expect(body.id).toEqual(expect.any(String));
    expect(body.elderId).toBe(elderId);
    expect(body.decision).toBe('TAKEN');
  });

  it('POST /logs 생성 후 GET /logs?elderId=...로 조회하면 반영되어 있다', async () => {
    await request(app.getHttpServer())
      .post('/logs')
      .send(
        buildCreateLogPayload({ decision: 'UNCERTAIN', sequenceConf: 0.75 }),
      )
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/logs')
      .query({ elderId })
      .expect(200);

    const body = res.body as Array<{ elderId: string; decision: string }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((log) => log.decision === 'UNCERTAIN')).toBe(true);
    expect(body.every((log) => log.elderId === elderId)).toBe(true);
  });

  it('GET /logs?elderId=&decision=UNCERTAIN 필터가 정상 동작한다', async () => {
    const res = await request(app.getHttpServer())
      .get('/logs')
      .query({ elderId, decision: 'MISSED' })
      .expect(200);

    const body = res.body as Array<{ decision: string }>;
    expect(body.every((log) => log.decision === 'MISSED')).toBe(true);
  });

  it('잘못된 decision 값으로 POST /logs 요청 시 400을 반환한다', async () => {
    await request(app.getHttpServer())
      .post('/logs')
      .send(buildCreateLogPayload({ decision: 'INVALID' }))
      .expect(400);
  });

  it('elderId 없이 GET /logs 요청 시 400을 반환한다', async () => {
    await request(app.getHttpServer()).get('/logs').expect(400);
  });
});

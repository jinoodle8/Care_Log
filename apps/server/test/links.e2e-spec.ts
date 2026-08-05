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

interface InviteCodeResponse {
  code: string;
  expiresAt: string;
}

describe('LinksController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
  let guardianId: string;

  const suffix = String(Date.now()).slice(-8);
  const guardianPhone = `010${suffix}`;
  const createdPhones: string[] = [guardianPhone];

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

    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: '연동 테스트 보호자',
        phone: guardianPhone,
        password: 'test-password-1234',
      })
      .expect(201);

    const body = res.body as AuthResponse;
    accessToken = body.accessToken;
    guardianId = body.user.id;
  }, 30000);

  afterAll(async () => {
    await prisma.link.deleteMany({ where: { guardianId } });
    await prisma.inviteCode.deleteMany({ where: { guardianId } });
    await prisma.user.deleteMany({ where: { phone: { in: createdPhones } } });
    await app.close();
  });

  async function issueCode(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/links/invite-code')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
    return (res.body as InviteCodeResponse).code;
  }

  it('POST /links/invite-code로 6자리 초대코드를 발급한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/links/invite-code')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const body = res.body as InviteCodeResponse;
    expect(body.code).toMatch(/^[2-9A-HJ-NP-Z]{6}$/);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('토큰 없이 초대코드를 발급하려 하면 401을 반환한다', async () => {
    await request(app.getHttpServer()).post('/links/invite-code').expect(401);
  });

  it('POST /links/redeem으로 어르신 계정을 만들고 보호자와 연동한다', async () => {
    const code = await issueCode();
    const elderPhone = `011${suffix}`;
    createdPhones.push(elderPhone);

    const res = await request(app.getHttpServer())
      .post('/links/redeem')
      .send({ code, elderName: '연동 테스트 어르신', elderPhone })
      .expect(201);

    const body = res.body as {
      elder: { id: string; role: string };
      linkId: string;
      accessToken: string;
      refreshToken: string;
    };
    expect(body.elder.role).toBe('ELDER');
    expect(body.linkId).toEqual(expect.any(String));
    // 어르신 기기가 이후 로그 업로드에 쓸 토큰이 함께 발급되어야 한다(M2-15).
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.refreshToken).toEqual(expect.any(String));

    const link = await prisma.link.findUnique({ where: { id: body.linkId } });
    expect(link).toMatchObject({ guardianId, elderId: body.elder.id });
  });

  it('이미 사용된 초대코드를 다시 쓰면 INVITE_CODE_ALREADY_REDEEMED를 반환한다', async () => {
    const code = await issueCode();
    const elderPhone = `012${suffix}`;
    createdPhones.push(elderPhone);

    await request(app.getHttpServer())
      .post('/links/redeem')
      .send({ code, elderName: '중복 사용 테스트', elderPhone })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/links/redeem')
      .send({
        code,
        elderName: '중복 사용 테스트2',
        elderPhone: `013${suffix}`,
      })
      .expect(400);

    expect((res.body as { code: string }).code).toBe(
      'INVITE_CODE_ALREADY_REDEEMED',
    );
  });

  it('만료된 초대코드를 쓰면 INVITE_CODE_EXPIRED를 반환한다', async () => {
    const code = await issueCode();
    await prisma.inviteCode.update({
      where: { code },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app.getHttpServer())
      .post('/links/redeem')
      .send({ code, elderName: '만료 테스트', elderPhone: `014${suffix}` })
      .expect(400);

    expect((res.body as { code: string }).code).toBe('INVITE_CODE_EXPIRED');
  });

  it('존재하지 않는 초대코드면 INVITE_CODE_INVALID를 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/links/redeem')
      .send({
        code: 'ZZZZZZ',
        elderName: '없는 코드',
        elderPhone: `015${suffix}`,
      })
      .expect(400);

    expect((res.body as { code: string }).code).toBe('INVITE_CODE_INVALID');
  });

  it('GET /users/me/elders로 연동된 어르신 목록을 조회한다', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me/elders')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = res.body as Array<{ role: string; name: string }>;
    expect(body.length).toBeGreaterThanOrEqual(2);
    expect(body.every((elder) => elder.role === 'ELDER')).toBe(true);
  });
});

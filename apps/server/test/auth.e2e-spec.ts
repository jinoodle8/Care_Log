import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { PrismaService } from './../src/prisma/prisma.service';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; role: string; name: string; phone: string };
}

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const phone = `010${String(Date.now()).slice(-8)}`;
  const password = 'test-password-1234';

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
  }, 30000);

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { phone } });
    await app.close();
  });

  it('POST /auth/signup으로 보호자 계정을 만들면 토큰과 프로필을 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: '테스트 보호자', phone, password })
      .expect(201);

    const body = res.body as AuthResponse;
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.refreshToken).toEqual(expect.any(String));
    expect(body.user).toMatchObject({
      role: 'GUARDIAN',
      name: '테스트 보호자',
      phone,
    });
  });

  it('이미 가입된 전화번호로 재가입하면 PHONE_ALREADY_REGISTERED 에러를 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: '중복 보호자', phone, password })
      .expect(400);

    expect((res.body as { code: string }).code).toBe(
      'PHONE_ALREADY_REGISTERED',
    );
  });

  it('POST /auth/login으로 로그인하면 토큰을 발급한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone, password })
      .expect(200);

    const body = res.body as AuthResponse;
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.user.phone).toBe(phone);
  });

  it('잘못된 비밀번호로 로그인하면 401 INVALID_CREDENTIALS를 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone, password: 'wrong-password' })
      .expect(401);

    expect((res.body as { code: string }).code).toBe('INVALID_CREDENTIALS');
  });

  it('발급된 access token으로 GET /users/me를 호출하면 내 프로필을 반환한다', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone, password })
      .expect(200);
    const { accessToken } = loginRes.body as AuthResponse;

    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toMatchObject({ role: 'GUARDIAN', phone });
  });

  it('토큰 없이 GET /users/me를 호출하면 401을 반환한다', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('refresh token으로 토큰을 재발급받을 수 있다', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone, password })
      .expect(200);
    const { refreshToken } = loginRes.body as AuthResponse;

    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    const body = res.body as AuthResponse;
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.user.phone).toBe(phone);
  });

  it('잘못된 refresh token이면 401 INVALID_REFRESH_TOKEN을 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'not-a-valid-token' })
      .expect(401);

    expect((res.body as { code: string }).code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('8자 미만 비밀번호로 회원가입하면 400을 반환한다', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: '짧은비번',
        phone: `011${String(Date.now()).slice(-8)}`,
        password: 'short',
      })
      .expect(400);
  });
});

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

interface PresignResponse {
  uploadUrl: string;
  videoRef: string;
  requiredHeaders: Record<string, string>;
  expiresInSeconds: number;
}

describe('MediaController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = uniquePhoneSuffix();
  const guardianPhone = `010${suffix}`;
  const elderPhone = `011${suffix}`;
  const password = 'test-password-1234';

  let guardianToken: string;
  let guardianId: string;
  let elderToken: string;

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
      .send({ name: '미디어 보호자', phone: guardianPhone, password })
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
        elderName: '미디어 어르신',
        elderPhone,
      })
      .expect(201);
    elderToken = (redeemRes.body as RedeemResponse).accessToken;
  }, 30000);

  afterAll(async () => {
    await prisma.link.deleteMany({ where: { guardianId } });
    await prisma.inviteCode.deleteMany({ where: { guardianId } });
    await prisma.user.deleteMany({
      where: { phone: { in: [guardianPhone, elderPhone] } },
    });
    await app.close();
  });

  it('어르신 토큰으로 presign을 요청하면 업로드 URL과 videoRef를 발급한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/media/presign')
      .set('Authorization', `Bearer ${elderToken}`)
      .send({ contentType: 'video/mp4' })
      .expect(201);

    const body = res.body as PresignResponse;
    expect(body.uploadUrl).toContain('X-Amz-Signature');
    expect(body.videoRef).toMatch(
      /^s3:\/\/[^/]+\/\d{4}\/\d{2}\/\d{2}\/[0-9a-f]{32}\.mp4$/,
    );
    expect(body.requiredHeaders['x-amz-server-side-encryption']).toBe('AES256');
    expect(body.expiresInSeconds).toBeGreaterThan(0);
  });

  it('요청마다 서로 다른 키를 발급한다', async () => {
    const refs = await Promise.all(
      [1, 2, 3].map(async () => {
        const res = await request(app.getHttpServer())
          .post('/media/presign')
          .set('Authorization', `Bearer ${elderToken}`)
          .send({ contentType: 'video/mp4' })
          .expect(201);
        return (res.body as PresignResponse).videoRef;
      }),
    );
    expect(new Set(refs).size).toBe(3);
  });

  it('보호자 토큰으로 요청하면 403을 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/media/presign')
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({ contentType: 'video/mp4' })
      .expect(403);

    expect((res.body as { code: string }).code).toBe('FORBIDDEN');
  });

  it('토큰 없이 요청하면 401을 반환한다', async () => {
    await request(app.getHttpServer())
      .post('/media/presign')
      .send({ contentType: 'video/mp4' })
      .expect(401);
  });

  it('허용되지 않은 contentType은 400을 반환한다', async () => {
    await request(app.getHttpServer())
      .post('/media/presign')
      .set('Authorization', `Bearer ${elderToken}`)
      .send({ contentType: 'application/zip' })
      .expect(400);
  });

  it('상한을 넘는 sizeBytes는 400을 반환한다', async () => {
    await request(app.getHttpServer())
      .post('/media/presign')
      .set('Authorization', `Bearer ${elderToken}`)
      .send({ contentType: 'video/mp4', sizeBytes: 500 * 1024 * 1024 })
      .expect(400);
  });

  it('발급받은 URL로 실제 PUT 업로드가 성공한다 (MinIO 필요)', async () => {
    const res = await request(app.getHttpServer())
      .post('/media/presign')
      .set('Authorization', `Bearer ${elderToken}`)
      .send({ contentType: 'video/mp4' })
      .expect(201);

    const { uploadUrl, requiredHeaders } = res.body as PresignResponse;
    const body = Buffer.from('fake-mp4-bytes-for-e2e');

    const uploaded = await fetch(uploadUrl, {
      method: 'PUT',
      headers: requiredHeaders,
      body,
    });

    expect(uploaded.status).toBe(200);
    // 버킷 기본 암호화(M4-03)가 적용됐는지 응답 헤더로 확인한다.
    expect(uploaded.headers.get('x-amz-server-side-encryption')).toBe('AES256');
  }, 30000);
});

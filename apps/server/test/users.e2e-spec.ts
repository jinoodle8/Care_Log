import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { UserProfile } from '@carelog/shared';
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

describe('사용자 프로필 (e2e)', () => {
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

  /** 이 스펙은 전화번호를 바꾸므로 정리 대상 번호를 따로 추적한다. */
  const extraPhones: string[] = [];

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
      .send({ name: '설정 보호자', phone: guardianPhone, password })
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
        elderName: '설정 어르신',
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
    await prisma.auditLog.deleteMany({
      where: { OR: [{ actorId: guardianId }, { actorId: elderId }] },
    });
    await prisma.medicationLog.deleteMany({ where: { elderId } });
    await prisma.link.deleteMany({ where: { guardianId } });
    await prisma.inviteCode.deleteMany({ where: { guardianId } });
    await prisma.user.deleteMany({
      where: {
        phone: {
          in: [guardianPhone, elderPhone, otherGuardianPhone, ...extraPhones],
        },
      },
    });
    await app.close();
  });

  describe('PATCH /users/me (M7-01)', () => {
    it('이름만 보내면 이름만 바뀐다', async () => {
      const res = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${guardianToken}`)
        .send({ name: '이름 바꿈' })
        .expect(200);

      const body = res.body as UserProfile;
      expect(body.name).toBe('이름 바꿈');
      expect(body.phone).toBe(guardianPhone);
    });

    it('전화번호를 바꾸면 새 번호로 로그인할 수 있다', async () => {
      const newPhone = `013${suffix}`;
      extraPhones.push(newPhone);

      await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${guardianToken}`)
        .send({ phone: newPhone })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ phone: newPhone, password })
        .expect(200);

      // 뒷 테스트를 위해 원래 번호로 되돌린다.
      await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${guardianToken}`)
        .send({ phone: guardianPhone })
        .expect(200);
    }, 30000);

    it('이미 쓰는 전화번호로 바꾸면 PHONE_ALREADY_REGISTERED', async () => {
      const res = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${guardianToken}`)
        .send({ phone: otherGuardianPhone })
        .expect(400);

      expect((res.body as { code: string }).code).toBe(
        'PHONE_ALREADY_REGISTERED',
      );
    });

    it('자기 번호를 그대로 보내는 것은 허용한다', async () => {
      await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${guardianToken}`)
        .send({ phone: guardianPhone })
        .expect(200);
    });

    it('빈 본문은 NOTHING_TO_UPDATE로 거부한다', async () => {
      const res = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${guardianToken}`)
        .send({})
        .expect(400);

      expect((res.body as { code: string }).code).toBe('NOTHING_TO_UPDATE');
    });

    it('어르신도 자기 정보를 수정할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${elderToken}`)
        .send({ name: '어르신 이름 바꿈' })
        .expect(200);

      expect((res.body as UserProfile).name).toBe('어르신 이름 바꿈');
    });

    it('토큰 없이 호출하면 401', async () => {
      await request(app.getHttpServer())
        .patch('/users/me')
        .send({ name: '침입자' })
        .expect(401);
    });
  });

  describe('POST /users/me/password (M7-02)', () => {
    const newPassword = 'brand-new-password-99';

    it('현재 비밀번호가 맞으면 변경되고 새 비밀번호로 로그인된다', async () => {
      await request(app.getHttpServer())
        .post('/users/me/password')
        .set('Authorization', `Bearer ${guardianToken}`)
        .send({ currentPassword: password, newPassword })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ phone: guardianPhone, password: newPassword })
        .expect(200);

      // 예전 비밀번호로는 더 이상 로그인되지 않는다.
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ phone: guardianPhone, password })
        .expect(401);

      // 되돌려 둔다.
      await request(app.getHttpServer())
        .post('/users/me/password')
        .set('Authorization', `Bearer ${guardianToken}`)
        .send({ currentPassword: newPassword, newPassword: password })
        .expect(200);
    }, 30000);

    it('현재 비밀번호가 틀리면 거부하고 비밀번호를 바꾸지 않는다', async () => {
      const res = await request(app.getHttpServer())
        .post('/users/me/password')
        .set('Authorization', `Bearer ${guardianToken}`)
        .send({ currentPassword: 'wrong-password', newPassword })
        .expect(401);

      expect((res.body as { code: string }).code).toBe('INVALID_CREDENTIALS');

      // 원래 비밀번호가 그대로여야 한다.
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ phone: guardianPhone, password })
        .expect(200);
    }, 30000);

    it('너무 짧은 새 비밀번호는 400', async () => {
      await request(app.getHttpServer())
        .post('/users/me/password')
        .set('Authorization', `Bearer ${guardianToken}`)
        .send({ currentPassword: password, newPassword: 'short' })
        .expect(400);
    });

    it('비밀번호가 없는 어르신 계정은 PASSWORD_NOT_SET', async () => {
      const res = await request(app.getHttpServer())
        .post('/users/me/password')
        .set('Authorization', `Bearer ${elderToken}`)
        .send({ currentPassword: 'anything', newPassword })
        .expect(400);

      expect((res.body as { code: string }).code).toBe('PASSWORD_NOT_SET');
    });

    it('감사 로그에 비밀번호 값이 남지 않는다', async () => {
      const entries = await prisma.auditLog.findMany({
        where: { action: 'user.password_change', actorId: guardianId },
      });
      expect(entries.length).toBeGreaterThan(0);

      const serialized = JSON.stringify(entries);
      expect(serialized).not.toContain(password);
      expect(serialized).not.toContain(newPassword);
    });
  });

  describe('PATCH /users/elders/:id (M7-03)', () => {
    it('연동된 보호자는 어르신 정보를 수정할 수 있다', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/elders/${elderId}`)
        .set('Authorization', `Bearer ${guardianToken}`)
        .send({ name: '보호자가 바꾼 이름' })
        .expect(200);

      expect((res.body as UserProfile).name).toBe('보호자가 바꾼 이름');
    });

    it('연동되지 않은 보호자는 NOT_LINKED_ELDER 403', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/elders/${elderId}`)
        .set('Authorization', `Bearer ${otherGuardianToken}`)
        .send({ name: '남의 어르신' })
        .expect(403);

      expect((res.body as { code: string }).code).toBe('NOT_LINKED_ELDER');
    });

    it('어르신 토큰으로는 호출할 수 없다', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/elders/${elderId}`)
        .set('Authorization', `Bearer ${elderToken}`)
        .send({ name: '스스로' })
        .expect(403);

      expect((res.body as { code: string }).code).toBe('FORBIDDEN');
    });

    it('토큰 없이 호출하면 401', async () => {
      await request(app.getHttpServer())
        .patch(`/users/elders/${elderId}`)
        .send({ name: '침입자' })
        .expect(401);
    });
  });

  it('감사 로그에 전화번호·이름 평문이 남지 않는다', async () => {
    const entries = await prisma.auditLog.findMany({
      where: { OR: [{ actorId: guardianId }, { actorId: elderId }] },
    });
    expect(entries.length).toBeGreaterThan(0);

    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain(guardianPhone);
    expect(serialized).not.toContain(elderPhone);
    expect(serialized).not.toContain('보호자가 바꾼 이름');
  });
});

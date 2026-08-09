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

describe('감사 로그 (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = uniquePhoneSuffix();
  const guardianPhone = `010${suffix}`;
  const elderPhone = `011${suffix}`;
  const elderName = '감사어르신';
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

    const guardianRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: '감사 보호자', phone: guardianPhone, password })
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
        elderName,
        elderPhone,
      })
      .expect(201);
    elderToken = (redeemRes.body as RedeemResponse).accessToken;
    elderId = (redeemRes.body as RedeemResponse).elder.id;
  }, 30000);

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { OR: [{ actorId: guardianId }, { actorId: elderId }] },
    });
    await prisma.schedule.deleteMany({ where: { elderId } });
    await prisma.medicationLog.deleteMany({ where: { elderId } });
    await prisma.link.deleteMany({ where: { guardianId } });
    await prisma.inviteCode.deleteMany({ where: { guardianId } });
    await prisma.user.deleteMany({
      where: { phone: { in: [guardianPhone, elderPhone] } },
    });
    await app.close();
  });

  it('초대코드 발급이 기록되고, 코드 값은 남지 않는다', async () => {
    const entry = await prisma.auditLog.findFirst({
      where: { action: 'link.invite_code_create', actorId: guardianId },
      orderBy: { createdAt: 'desc' },
    });

    expect(entry).not.toBeNull();
    expect(entry?.actorRole).toBe('GUARDIAN');
    expect(JSON.stringify(entry?.detailJson)).not.toContain('code');
  });

  it('연동(redeem)이 기록되고, 이름·전화번호는 마스킹된다', async () => {
    const entry = await prisma.auditLog.findFirst({
      where: { action: 'link.redeem', actorId: elderId },
      orderBy: { createdAt: 'desc' },
    });

    expect(entry).not.toBeNull();
    const detail = entry?.detailJson as Record<string, unknown>;
    expect(detail.elderName).toBe(
      `${elderName.slice(0, 1)}${'*'.repeat(elderName.length - 1)}`,
    );
    expect(detail.elderPhone).toBe(`***${elderPhone.slice(-4)}`);
    expect(detail.guardianId).toBe(guardianId);
  });

  it('스케줄 생성·수정·삭제가 각각 기록된다', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/schedules')
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({ elderId, slot: 'EVENING', time: '19:00' })
      .expect(201);
    const scheduleId = (createRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .patch(`/schedules/${scheduleId}`)
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({ time: '20:00' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/schedules/${scheduleId}`)
      .set('Authorization', `Bearer ${guardianToken}`)
      .expect(200);

    const entries = await prisma.auditLog.findMany({
      where: { targetType: 'Schedule', targetId: scheduleId },
      orderBy: { createdAt: 'asc' },
    });

    expect(entries.map((e) => e.action)).toEqual([
      'schedule.create',
      'schedule.update',
      'schedule.delete',
    ]);

    const update = entries[1].detailJson as Record<string, unknown>;
    expect(update.fromTime).toBe('19:00');
    expect(update.toTime).toBe('20:00');
  }, 30000);

  it('수동확인이 판정 변경 내역과 함께 기록되고, 메모 본문은 남지 않는다', async () => {
    const logRes = await request(app.getHttpServer())
      .post('/logs')
      .set('Authorization', `Bearer ${elderToken}`)
      .send({
        takenAt: new Date().toISOString(),
        decision: 'UNCERTAIN',
        sequenceConf: 0.72,
        detections: [{ cls: 'face', conf: 0.9, bbox: [0.4, 0.4, 0.6, 0.6] }],
        actionSequence: ['pick_up'],
      })
      .expect(201);
    const logId = (logRes.body as { id: string }).id;

    const secretNote = '요양보호사 박씨가 직접 확인함';
    await request(app.getHttpServer())
      .patch(`/logs/${logId}/manual-confirm`)
      .set('Authorization', `Bearer ${guardianToken}`)
      .send({ decision: 'TAKEN', note: secretNote })
      .expect(200);

    const entry = await prisma.auditLog.findFirst({
      where: { action: 'log.manual_confirm', targetId: logId },
    });

    expect(entry).not.toBeNull();
    expect(entry?.actorId).toBe(guardianId);
    const detail = entry?.detailJson as Record<string, unknown>;
    expect(detail.from).toBe('UNCERTAIN');
    expect(detail.to).toBe('TAKEN');
    expect(detail.hasNote).toBe(true);
    // 자유 입력 메모는 개인정보가 섞일 수 있으므로 본문을 저장하지 않는다.
    expect(JSON.stringify(entry?.detailJson)).not.toContain('박씨');

    await prisma.medicationLog.delete({ where: { id: logId } });
  }, 30000);

  it('영상 presign 발급·열람이 기록되고, 서명 URL은 남지 않는다', async () => {
    const presignRes = await request(app.getHttpServer())
      .post('/media/presign')
      .set('Authorization', `Bearer ${elderToken}`)
      .send({ contentType: 'video/mp4' })
      .expect(201);
    const { uploadUrl, videoRef, requiredHeaders } = presignRes.body as {
      uploadUrl: string;
      videoRef: string;
      requiredHeaders: Record<string, string>;
    };

    const uploadEntry = await prisma.auditLog.findFirst({
      where: { action: 'media.presign_upload', actorId: elderId },
      orderBy: { createdAt: 'desc' },
    });
    expect(uploadEntry).not.toBeNull();
    expect(JSON.stringify(uploadEntry)).not.toContain('X-Amz-Signature');

    await fetch(uploadUrl, {
      method: 'PUT',
      headers: requiredHeaders,
      body: Buffer.from('audit-playback-bytes'),
    });

    const logRes = await request(app.getHttpServer())
      .post('/logs')
      .set('Authorization', `Bearer ${elderToken}`)
      .send({
        takenAt: new Date().toISOString(),
        decision: 'UNCERTAIN',
        sequenceConf: 0.7,
        detections: [{ cls: 'face', conf: 0.9, bbox: [0.4, 0.4, 0.6, 0.6] }],
        actionSequence: ['pick_up'],
        videoRef,
      })
      .expect(201);
    const logId = (logRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .get(`/logs/${logId}/video-url`)
      .set('Authorization', `Bearer ${guardianToken}`)
      .expect(200);

    const playbackEntry = await prisma.auditLog.findFirst({
      where: { action: 'media.presign_playback', targetId: logId },
    });
    expect(playbackEntry).not.toBeNull();
    expect(playbackEntry?.actorId).toBe(guardianId);
    expect(JSON.stringify(playbackEntry)).not.toContain('X-Amz-Signature');

    await prisma.medicationLog.delete({ where: { id: logId } });
  }, 30000);

  it('감사 로그 어디에도 전화번호·이름 평문이 남지 않는다', async () => {
    const entries = await prisma.auditLog.findMany({
      where: { OR: [{ actorId: guardianId }, { actorId: elderId }] },
    });
    expect(entries.length).toBeGreaterThan(0);

    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain(elderPhone);
    expect(serialized).not.toContain(guardianPhone);
    expect(serialized).not.toContain(elderName);
  });
});

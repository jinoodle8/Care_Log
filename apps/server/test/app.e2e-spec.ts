import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  // 테스트가 앱 상태를 바꾸지 않으므로 한 번만 띄운다(모듈이 늘면서 매 테스트 재생성은 비용이 큼).
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
  }, 30000);

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('존재하지 않는 라우트는 통일된 에러 포맷으로 404를 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .get('/no-such-route')
      .expect(404);

    const body = res.body as {
      statusCode: number;
      code: string;
      message: string;
      timestamp: string;
      path: string;
    };

    expect(body).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      path: '/no-such-route',
    });
    expect(typeof body.message).toBe('string');
    expect(typeof body.timestamp).toBe('string');
  });

  afterAll(async () => {
    await app.close();
  });
});

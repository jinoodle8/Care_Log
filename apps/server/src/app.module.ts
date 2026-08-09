import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppThrottlerModule } from './common/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { LinksModule } from './links/links.module';
import { LogsModule } from './logs/logs.module';
import { MediaModule } from './media/media.module';
import { PrismaModule } from './prisma/prisma.module';
import { PushModule } from './push/push.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SchedulesModule } from './schedules/schedules.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 전역 가드 실행 순서를 위해 인증(AuthModule)보다 먼저 둔다.
    AppThrottlerModule,
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    AuthModule,
    LinksModule,
    PushModule,
    RealtimeModule,
    LogsModule,
    SchedulesModule,
    MediaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

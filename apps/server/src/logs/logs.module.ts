import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';

@Module({
  imports: [RealtimeModule],
  controllers: [LogsController],
  providers: [LogsService],
  exports: [LogsService],
})
export class LogsModule {}

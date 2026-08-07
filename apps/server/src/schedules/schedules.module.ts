import { Module } from '@nestjs/common';
import { PushModule } from '../push/push.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { MissedDetectionService } from './missed-detection.service';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [RealtimeModule, PushModule],
  controllers: [SchedulesController],
  providers: [SchedulesService, MissedDetectionService],
  exports: [SchedulesService, MissedDetectionService],
})
export class SchedulesModule {}

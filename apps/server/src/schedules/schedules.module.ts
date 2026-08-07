import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { MissedDetectionService } from './missed-detection.service';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [RealtimeModule],
  controllers: [SchedulesController],
  providers: [SchedulesService, MissedDetectionService],
  exports: [SchedulesService, MissedDetectionService],
})
export class SchedulesModule {}

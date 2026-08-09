import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/** 여러 모듈이 얇게 가져다 쓰므로 전역으로 둔다. */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}

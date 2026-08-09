import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** 헬스체크. 인증 없이 열어 둔다. */
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}

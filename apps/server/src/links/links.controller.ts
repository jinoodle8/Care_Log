import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { CreateInviteCodeResponse, UserProfile } from '@carelog/shared';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { STRICT_THROTTLE } from '../common/throttler';
import { RedeemInviteCodeDto } from './dto/redeem-invite-code.dto';
import { LinksService, type RedeemResult } from './links.service';

@Controller()
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Roles('GUARDIAN')
  @Post('links/invite-code')
  @HttpCode(HttpStatus.CREATED)
  createInviteCode(@Req() req: Request): Promise<CreateInviteCodeResponse> {
    const user = req.user as { id: string };
    return this.linksService.createInviteCode(user.id);
  }

  /** 초대코드 자체가 권한이므로 인증 없이 호출한다(어르신 기기 최초 설정).
   * 인증이 없는 만큼 코드 대입을 막기 위해 상한을 낮춘다(M4-08). */
  @Throttle(STRICT_THROTTLE)
  @Public()
  @Post('links/redeem')
  @HttpCode(HttpStatus.CREATED)
  redeem(@Body() dto: RedeemInviteCodeDto): Promise<RedeemResult> {
    return this.linksService.redeem(dto);
  }

  @Roles('GUARDIAN')
  @Get('users/me/elders')
  listElders(@Req() req: Request): Promise<UserProfile[]> {
    const user = req.user as { id: string };
    return this.linksService.listElders(user.id);
  }
}

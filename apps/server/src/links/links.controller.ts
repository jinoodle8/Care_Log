import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { CreateInviteCodeResponse, UserProfile } from '@carelog/shared';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RedeemInviteCodeDto } from './dto/redeem-invite-code.dto';
import { LinksService, type RedeemResult } from './links.service';

@Controller()
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Post('links/invite-code')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  createInviteCode(@Req() req: Request): Promise<CreateInviteCodeResponse> {
    const user = req.user as { id: string };
    return this.linksService.createInviteCode(user.id);
  }

  /** 초대코드 자체가 권한이므로 인증 없이 호출한다(어르신 기기 최초 설정). */
  @Post('links/redeem')
  @HttpCode(HttpStatus.CREATED)
  redeem(@Body() dto: RedeemInviteCodeDto): Promise<RedeemResult> {
    return this.linksService.redeem(dto);
  }

  @Get('users/me/elders')
  @UseGuards(JwtAuthGuard)
  listElders(@Req() req: Request): Promise<UserProfile[]> {
    const user = req.user as { id: string };
    return this.linksService.listElders(user.id);
  }
}

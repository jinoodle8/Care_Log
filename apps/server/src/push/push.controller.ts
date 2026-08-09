import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

@Controller('users/me')
export class PushController {
  constructor(private readonly prisma: PrismaService) {}

  /** 앱이 발급받은 Expo 푸시 토큰을 자기 계정에 등록한다. */
  @Post('push-token')
  @HttpCode(HttpStatus.OK)
  async registerPushToken(
    @Req() req: Request,
    @Body() dto: RegisterPushTokenDto,
  ): Promise<{ ok: true }> {
    const user = req.user as { id: string };
    await this.prisma.user.update({
      where: { id: user.id },
      data: { pushToken: dto.pushToken },
    });
    return { ok: true };
  }
}

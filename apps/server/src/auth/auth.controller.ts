import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { UserProfile } from '@carelog/shared';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { STRICT_THROTTLE } from '../common/throttler';
import { AuthService, type AuthResult } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SignupDto } from './dto/signup.dto';
import { Public } from './public.decorator';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('auth/signup')
  @HttpCode(HttpStatus.CREATED)
  signup(@Body() dto: SignupDto): Promise<AuthResult> {
    return this.authService.signup(dto);
  }

  /** 비밀번호 대입 공격을 막기 위해 상한을 낮춘다(M4-08). */
  @Throttle(STRICT_THROTTLE)
  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.authService.login(dto);
  }

  /** access token이 만료된 상태로 호출하므로 인증 대상에서 제외한다(refresh token 자체가 권한). */
  @Public()
  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto): Promise<AuthResult> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Get('users/me')
  me(@Req() req: Request): Promise<UserProfile> {
    const user = req.user as { id: string };
    return this.authService.getProfile(user.id);
  }
}

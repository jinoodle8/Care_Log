import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { UserProfile } from '@carelog/shared';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService, type AuthUser } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** 내 이름·전화번호 수정 (M7-01) */
  @Patch('me')
  updateProfile(
    @Req() req: Request,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    return this.usersService.updateProfile(req.user as AuthUser, dto);
  }

  /** 비밀번호 변경 (M7-02) */
  @Post('me/password')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @Req() req: Request,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ ok: true }> {
    return this.usersService.changePassword(req.user as AuthUser, dto);
  }

  /** 보호자가 연동된 어르신 정보를 대신 수정 (M7-03) */
  @Roles('GUARDIAN')
  @Patch('elders/:id')
  updateElder(
    @Req() req: Request,
    @Param('id') elderId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    return this.usersService.updateElderProfile(
      req.user as AuthUser,
      elderId,
      dto,
    );
  }
}

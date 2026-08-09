import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PresignUploadDto } from './dto/presign-upload.dto';
import {
  MediaService,
  type AuthUser,
  type PresignUploadResult,
} from './media.service';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('presign')
  @HttpCode(HttpStatus.CREATED)
  presign(
    @Req() req: Request,
    @Body() dto: PresignUploadDto,
  ): Promise<PresignUploadResult> {
    return this.mediaService.presignUpload(req.user as AuthUser, dto);
  }
}

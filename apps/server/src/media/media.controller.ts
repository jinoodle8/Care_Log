import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { PresignUploadDto } from './dto/presign-upload.dto';
import {
  MediaService,
  type AuthUser,
  type PresignUploadResult,
} from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Roles('ELDER')
  @Post('presign')
  @HttpCode(HttpStatus.CREATED)
  presign(
    @Req() req: Request,
    @Body() dto: PresignUploadDto,
  ): Promise<PresignUploadResult> {
    return this.mediaService.presignUpload(req.user as AuthUser, dto);
  }
}

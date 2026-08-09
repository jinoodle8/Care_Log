import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ALLOWED_VIDEO_CONTENT_TYPES } from '../media-key';

/** 녹화 최대 15초 영상 기준 상한(바이트). 초과 요청은 발급 단계에서 막는다. */
export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;

export class PresignUploadDto {
  @IsIn(ALLOWED_VIDEO_CONTENT_TYPES)
  contentType!: string;

  /** 클라이언트가 아는 파일 크기(선택). 상한 초과 시 발급을 거부한다. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_VIDEO_SIZE_BYTES)
  sizeBytes?: number;
}

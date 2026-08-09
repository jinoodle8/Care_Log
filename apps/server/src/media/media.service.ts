import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  ServerSideEncryption,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Role } from '@carelog/shared';
import { AUDIT_ACTIONS, AuditService } from '../audit/audit.service';
import { AppException } from '../common/exceptions/app.exception';
import { PresignUploadDto } from './dto/presign-upload.dto';
import {
  buildVideoKey,
  parseVideoRef,
  toVideoRef,
  type AllowedVideoContentType,
} from './media-key';

export interface AuthUser {
  id: string;
  role: Role;
}

export interface PresignUploadResult {
  /** 클라이언트가 이 URL로 직접 PUT 한다. 서버는 영상 바이트를 거치지 않는다. */
  uploadUrl: string;
  /** 업로드 성공 후 POST /logs의 videoRef로 그대로 넘긴다. */
  videoRef: string;
  /** PUT 시 반드시 함께 보내야 하는 헤더(서명에 포함되어 있어 빠지면 403). */
  requiredHeaders: Record<string, string>;
  expiresInSeconds: number;
}

const DEFAULT_PRESIGN_EXPIRES_SECONDS = 300;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly expiresIn: number;

  /** 발급되는 presigned URL의 유효 시간(초). 클라이언트가 재발급 시점을 판단할 때 쓴다. */
  get presignExpiresInSeconds(): number {
    return this.expiresIn;
  }

  constructor(
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');

    this.bucket = this.config.get<string>('S3_BUCKET') ?? 'carelog-vault';
    this.expiresIn = Number(
      this.config.get<string>('S3_PRESIGN_EXPIRES_SECONDS') ??
        DEFAULT_PRESIGN_EXPIRES_SECONDS,
    );

    this.client = new S3Client({
      region: this.config.get<string>('S3_REGION') ?? 'ap-northeast-2',
      // MinIO는 가상 호스트 방식 주소를 쓰지 않으므로 endpoint가 있으면 path-style로 강제한다.
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }

  /**
   * 어르신 기기가 녹화 영상을 S3로 직접 올릴 수 있는 presigned PUT URL을 발급한다(TRD 5.2).
   * 서버는 URL만 서명하고 영상 바이트는 취급하지 않는다.
   */
  async presignUpload(
    user: AuthUser,
    dto: PresignUploadDto,
  ): Promise<PresignUploadResult> {
    if (user.role !== 'ELDER') {
      throw new AppException(
        'FORBIDDEN',
        '어르신 계정만 영상을 올릴 수 있습니다.',
        403,
      );
    }

    const contentType = dto.contentType as AllowedVideoContentType;
    const key = buildVideoKey(contentType);

    // 버킷 기본 암호화(M4-03)에 더해 요청에도 명시한다. 헤더가 서명에 포함되므로
    // 클라이언트는 requiredHeaders를 그대로 실어 보내야 한다.
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ServerSideEncryption: ServerSideEncryption.AES256,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: this.expiresIn,
    });

    // 서명 URL은 남기지 않고(자체가 접근 권한) 어떤 키를 발급했는지만 남긴다.
    await this.audit.record({
      action: AUDIT_ACTIONS.MEDIA_PRESIGN_UPLOAD,
      actorId: user.id,
      actorRole: user.role,
      targetType: 'MediaObject',
      targetId: key,
      detail: { contentType, sizeBytes: dto.sizeBytes },
    });

    return {
      uploadUrl,
      videoRef: toVideoRef(this.bucket, key),
      requiredHeaders: {
        'Content-Type': contentType,
        'x-amz-server-side-encryption': 'AES256',
      },
      expiresInSeconds: this.expiresIn,
    };
  }

  /**
   * 보호자가 UNCERTAIN 건을 확인할 때 쓸 재생용 presigned GET URL을 만든다(M4-05).
   * 접근 권한 확인은 호출부(LogsService)가 이미 끝냈다는 전제다.
   */
  async presignPlayback(videoRef: string): Promise<string | null> {
    const parsed = parseVideoRef(videoRef);
    if (!parsed) {
      this.logger.warn('videoRef 형식이 올바르지 않아 재생 URL을 건너뜁니다.');
      return null;
    }

    const command = new GetObjectCommand({
      Bucket: parsed.bucket,
      Key: parsed.key,
    });
    return getSignedUrl(this.client, command, { expiresIn: this.expiresIn });
  }
}

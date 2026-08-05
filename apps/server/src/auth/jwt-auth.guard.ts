import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** JWT access token이 필요한 라우트에 사용한다. 전체 라우트 적용 정리는 M2-15에서 진행한다. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

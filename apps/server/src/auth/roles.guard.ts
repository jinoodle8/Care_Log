import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@carelog/shared';
import type { Request } from 'express';
import { AppException } from '../common/exceptions/app.exception';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';

/**
 * @Roles()로 지정된 역할만 통과시킨다(M4-06).
 * 권한 에러 코드는 서비스 계층과 동일하게 FORBIDDEN으로 맞춘다.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const allowed = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!allowed || allowed.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user: { role?: Role } | undefined = request.user;
    if (!user?.role || !allowed.includes(user.role)) {
      throw new AppException(
        'FORBIDDEN',
        '이 작업을 수행할 권한이 없습니다.',
        403,
      );
    }
    return true;
  }
}

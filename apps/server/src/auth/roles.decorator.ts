import { SetMetadata } from '@nestjs/common';
import type { Role } from '@carelog/shared';

export const ROLES_KEY = 'carelog:roles';

/** 이 라우트를 호출할 수 있는 역할을 제한한다. 미지정이면 두 역할 모두 허용. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Role } from '@carelog/shared';

export interface JwtPayload {
  sub: string;
  role: Role;
}

/** 요청의 Authorization: Bearer 토큰을 검증하고 req.user에 { id, role }을 채운다. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        config.get<string>('JWT_ACCESS_SECRET') ??
        'dev-access-secret-change-me',
    });
  }

  validate(payload: JwtPayload): { id: string; role: Role } {
    return { id: payload.sub, role: payload.role };
  }
}

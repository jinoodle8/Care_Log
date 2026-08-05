import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type { AuthTokens, Role, UserProfile } from '@carelog/shared';
import * as bcrypt from 'bcrypt';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import type { JwtPayload } from './jwt.strategy';

const BCRYPT_ROUNDS = 10;

export interface AuthResult extends AuthTokens {
  user: UserProfile;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** 보호자 회원가입. 어르신 계정은 보호자가 초대코드로 대신 생성한다(M2-13). */
  async signup(dto: SignupDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (existing) {
      throw new AppException(
        'PHONE_ALREADY_REGISTERED',
        '이미 가입된 전화번호입니다.',
      );
    }

    const user = await this.prisma.user.create({
      data: {
        role: 'GUARDIAN',
        name: dto.name,
        phone: dto.phone,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      },
    });

    return this.buildAuthResult(user.id, user.role, user.name, user.phone);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (
      !user?.passwordHash ||
      !(await bcrypt.compare(dto.password, user.passwordHash))
    ) {
      throw new AppException(
        'INVALID_CREDENTIALS',
        '전화번호 또는 비밀번호가 올바르지 않습니다.',
        401,
      );
    }

    return this.buildAuthResult(user.id, user.role, user.name, user.phone);
  }

  /** refresh token으로 access/refresh 토큰을 재발급한다. */
  async refresh(refreshToken: string): Promise<AuthResult> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret:
          this.config.get<string>('JWT_REFRESH_SECRET') ??
          'dev-refresh-secret-change-me',
      });
    } catch {
      throw new AppException(
        'INVALID_REFRESH_TOKEN',
        '다시 로그인해 주세요.',
        401,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new AppException(
        'INVALID_REFRESH_TOKEN',
        '다시 로그인해 주세요.',
        401,
      );
    }

    return this.buildAuthResult(user.id, user.role, user.name, user.phone);
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppException(
        'USER_NOT_FOUND',
        '사용자를 찾을 수 없습니다.',
        404,
      );
    }
    return { id: user.id, role: user.role, name: user.name, phone: user.phone };
  }

  private async buildAuthResult(
    id: string,
    role: Role,
    name: string,
    phone: string,
  ): Promise<AuthResult> {
    const payload: JwtPayload = { sub: id, role };

    // expiresIn은 jsonwebtoken이 "15m" 같은 리터럴 타입을 요구하지만 설정값은 string으로 들어온다.
    type ExpiresIn = JwtSignOptions['expiresIn'];

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret:
          this.config.get<string>('JWT_ACCESS_SECRET') ??
          'dev-access-secret-change-me',
        expiresIn: (this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ??
          '15m') as ExpiresIn,
      }),
      this.jwt.signAsync(payload, {
        secret:
          this.config.get<string>('JWT_REFRESH_SECRET') ??
          'dev-refresh-secret-change-me',
        expiresIn: (this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ??
          '30d') as ExpiresIn,
      }),
    ]);

    return { accessToken, refreshToken, user: { id, role, name, phone } };
  }
}

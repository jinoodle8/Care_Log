import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import type { MedicationLog, Role } from '@carelog/shared';
import { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

interface SocketUser {
  id: string;
  role: Role;
}

export function elderRoom(elderId: string): string {
  return `elder:${elderId}`;
}

/** 보호자/어르신이 구독하는 실시간 채널(TRD 5.3). handshake의 JWT로 인증하고,
 * 연동된 어르신의 room에만 join을 허용한다. */
@WebSocketGateway({ namespace: '/realtime', cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-access-secret-change-me',
      });
      client.data.user = { id: payload.sub, role: payload.role } satisfies SocketUser;
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`disconnected: ${client.id}`);
  }

  /** 보호자는 연동된 어르신만, 어르신은 자기 자신만 구독할 수 있다. */
  @SubscribeMessage('subscribe')
  async handleSubscribe(
    client: Socket,
    payload: { elderId?: string },
  ): Promise<{ ok: boolean; code?: string }> {
    const user = client.data.user as SocketUser | undefined;
    const elderId = payload?.elderId;
    if (!user || !elderId) {
      return { ok: false, code: 'BAD_REQUEST' };
    }

    if (!(await this.canAccessElder(user, elderId))) {
      return { ok: false, code: 'NOT_LINKED_ELDER' };
    }

    await client.join(elderRoom(elderId));
    return { ok: true };
  }

  /** 복약 로그가 생성되면 해당 어르신 room에 브로드캐스트한다. */
  emitLogCreated(log: MedicationLog): void {
    this.server?.to(elderRoom(log.elderId)).emit('log.created', log);
  }

  private async canAccessElder(user: SocketUser, elderId: string): Promise<boolean> {
    if (user.role === 'ELDER') {
      return user.id === elderId;
    }
    const link = await this.prisma.link.findUnique({
      where: { elderId_guardianId: { elderId, guardianId: user.id } },
    });
    return link !== null;
  }
}

function extractToken(client: Socket): string | null {
  const authToken = client.handshake.auth?.token as unknown;
  if (typeof authToken === 'string' && authToken.length > 0) {
    return authToken.replace(/^Bearer\s+/i, '');
  }

  const header = client.handshake.headers.authorization;
  if (typeof header === 'string' && header.length > 0) {
    return header.replace(/^Bearer\s+/i, '');
  }
  return null;
}

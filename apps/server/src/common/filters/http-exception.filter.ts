import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ApiErrorResponseBody {
  statusCode: number;
  code: string;
  message: string;
  timestamp: string;
  path: string;
}

/** 모든 예외를 TRD 5.4 공통 포맷으로 변환한다: { statusCode, code, message, timestamp, path } */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const { code, message } = this.resolve(exception, statusCode);

    const body: ApiErrorResponseBody = {
      statusCode,
      code,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(body);
  }

  private resolve(
    exception: unknown,
    statusCode: number,
  ): { code: string; message: string } {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        return {
          code:
            typeof r.code === 'string' ? r.code : this.defaultCode(statusCode),
          message: this.extractMessage(r.message ?? exception.message),
        };
      }
      return { code: this.defaultCode(statusCode), message: exception.message };
    }
    return { code: 'INTERNAL_ERROR', message: 'Internal server error' };
  }

  private extractMessage(message: unknown): string {
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
    return 'Unexpected error';
  }

  private defaultCode(statusCode: number): string {
    const codeByStatus: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
    };
    return codeByStatus[statusCode] ?? 'INTERNAL_ERROR';
  }
}

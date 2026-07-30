import { HttpException, HttpStatus } from '@nestjs/common';

/** code를 명시하는 도메인 에러. 예: new AppException('INVITE_CODE_EXPIRED', '초대코드가 만료되었습니다.', HttpStatus.BAD_REQUEST) */
export class AppException extends HttpException {
  constructor(
    code: string,
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ code, message }, statusCode);
  }
}

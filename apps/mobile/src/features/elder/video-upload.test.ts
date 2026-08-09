import { contentTypeForUri, toFileUrl } from './video-upload';

describe('toFileUrl', () => {
  it('vision-camera가 주는 파일시스템 경로에 file:// 스킴을 붙인다', () => {
    expect(toFileUrl('/data/user/0/com.carelog/cache/rec.mp4')).toBe(
      'file:///data/user/0/com.carelog/cache/rec.mp4',
    );
    expect(toFileUrl('/var/mobile/Containers/tmp/rec.mov')).toBe(
      'file:///var/mobile/Containers/tmp/rec.mov',
    );
  });

  it('이미 스킴이 있으면 그대로 둔다', () => {
    expect(toFileUrl('file:///tmp/rec.mp4')).toBe('file:///tmp/rec.mp4');
    expect(toFileUrl('blob:http://localhost:8081/uuid')).toBe(
      'blob:http://localhost:8081/uuid',
    );
  });

  it('선행 슬래시가 없어도 올바른 URL을 만든다', () => {
    expect(toFileUrl('tmp/rec.mp4')).toBe('file:///tmp/rec.mp4');
  });
});

describe('contentTypeForUri', () => {
  it('iOS 녹화 결과(.mov)는 quicktime으로 판단한다', () => {
    expect(contentTypeForUri('file:///var/tmp/ABC-123.mov')).toBe(
      'video/quicktime',
    );
    expect(contentTypeForUri('file:///var/tmp/ABC-123.MOV')).toBe(
      'video/quicktime',
    );
  });

  it('Android 녹화 결과(.mp4)는 mp4로 판단한다', () => {
    expect(contentTypeForUri('file:///data/user/0/rec.mp4')).toBe('video/mp4');
  });

  it('쿼리스트링이 붙어도 확장자를 인식한다', () => {
    expect(contentTypeForUri('file:///tmp/rec.mov?ts=1')).toBe(
      'video/quicktime',
    );
  });

  it('확장자를 알 수 없으면 mp4로 처리한다', () => {
    expect(contentTypeForUri('blob:http://localhost:8081/uuid')).toBe(
      'video/mp4',
    );
  });
});

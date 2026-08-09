import { contentTypeForUri } from './video-upload';

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

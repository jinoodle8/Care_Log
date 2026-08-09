import { maskAuditDetail, maskName, maskPhone } from './audit-mask';

describe('maskPhone', () => {
  it('마지막 4자리만 남긴다', () => {
    expect(maskPhone('01012345678')).toBe('***5678');
  });

  it('너무 짧으면 통째로 가린다', () => {
    expect(maskPhone('123')).toBe('[REDACTED]');
    expect(maskPhone('')).toBe('[REDACTED]');
  });
});

describe('maskName', () => {
  it('성 한 글자만 남긴다', () => {
    expect(maskName('김복순')).toBe('김**');
    expect(maskName('이철')).toBe('이*');
  });

  it('한 글자 이름도 최소 한 칸은 가린다', () => {
    expect(maskName('김')).toBe('김*');
  });

  it('빈 문자열은 통째로 가린다', () => {
    expect(maskName('')).toBe('[REDACTED]');
  });
});

describe('maskAuditDetail', () => {
  it('비밀 값은 통째로 가린다', () => {
    expect(
      maskAuditDetail({
        password: 'hunter2',
        passwordHash: '$2b$10$abc',
        accessToken: 'ey.aaa.bbb',
        refreshToken: 'ey.ccc.ddd',
        pushToken: 'ExponentPushToken[xxx]',
        code: 'A2B3C4',
        uploadUrl: 'https://s3/...?X-Amz-Signature=zzz',
      }),
    ).toEqual({
      password: '[REDACTED]',
      passwordHash: '[REDACTED]',
      accessToken: '[REDACTED]',
      refreshToken: '[REDACTED]',
      pushToken: '[REDACTED]',
      code: '[REDACTED]',
      uploadUrl: '[REDACTED]',
    });
  });

  it('전화번호와 이름은 부분만 남긴다', () => {
    expect(
      maskAuditDetail({
        phone: '01012345678',
        elderPhone: '01098765432',
        name: '김복순',
        elderName: '박영자',
      }),
    ).toEqual({
      phone: '***5678',
      elderPhone: '***5432',
      name: '김**',
      elderName: '박**',
    });
  });

  it('식별자와 수치는 그대로 둔다(추적에 필요)', () => {
    const detail = {
      elderId: 'u_58f2',
      guardianId: 'g_91a7',
      slot: 'MORNING',
      time: '08:00',
      sequenceConf: 0.72,
      hasNote: true,
    };
    expect(maskAuditDetail(detail)).toEqual(detail);
  });

  it('중첩된 객체와 배열도 재귀적으로 마스킹한다', () => {
    expect(
      maskAuditDetail({
        actor: { name: '김보호', phone: '01011112222' },
        elders: [{ elderName: '이어르', elderPhone: '01033334444' }],
      }),
    ).toEqual({
      actor: { name: '김**', phone: '***2222' },
      elders: [{ elderName: '이**', elderPhone: '***4444' }],
    });
  });

  it('대소문자가 달라도 같은 키로 인식한다', () => {
    expect(maskAuditDetail({ Phone: '01012345678', PASSWORD: 'x' })).toEqual({
      Phone: '***5678',
      PASSWORD: '[REDACTED]',
    });
  });

  it('null과 원시값을 그대로 통과시킨다', () => {
    expect(maskAuditDetail(null)).toBeNull();
    expect(maskAuditDetail(42)).toBe(42);
    expect(maskAuditDetail('plain')).toBe('plain');
  });
});

/**
 * e2e 스펙들은 같은 DB를 병렬로 쓰므로 전화번호가 겹치면 signup이 실패한다.
 * 시각만 쓰면 같은 밀리초에 로드된 스펙끼리 충돌하므로 난수를 함께 섞는다.
 */
export function uniquePhoneSuffix(): string {
  const random = Math.floor(Math.random() * 100_000_000);
  return String(random).padStart(8, '0');
}

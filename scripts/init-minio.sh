#!/bin/sh
# 로컬 개발용 MinIO 버킷을 CareLog 보안 요구사항에 맞춰 초기화한다.
# 운영(AWS S3)에서는 같은 설정을 scripts/init-s3.sh로 적용한다 — 두 파일의 규칙은 동일해야 한다.
#
#   M4-01 버킷 생성
#   M4-03 SSE(AES-256) 기본 암호화 + 퍼블릭 접근 차단
#   M4-04 30일 라이프사이클(자동 만료)
set -eu

BUCKET="${S3_BUCKET:-carelog-vault}"
LIFECYCLE_DAYS="${S3_OBJECT_LIFECYCLE_DAYS:-30}"

echo "[init-minio] MinIO 기동 대기..."
until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
  sleep 1
done

echo "[init-minio] 버킷 생성: $BUCKET"
mc mb --ignore-existing "local/$BUCKET"

# 영상은 presigned URL로만 접근한다. 익명 접근은 어떤 경우에도 열지 않는다(CLAUDE.md 7장).
echo "[init-minio] 퍼블릭 접근 차단"
mc anonymous set none "local/$BUCKET"

# 서버측 암호화(SSE-S3 = AES-256). 클라이언트가 헤더를 빠뜨려도 버킷 기본값으로 암호화된다.
echo "[init-minio] 기본 암호화 설정 (SSE-S3 / AES-256)"
mc encrypt set sse-s3 "local/$BUCKET"

# 영상 원본은 30일 뒤 자동 삭제한다. 보관 기간을 늘리려면 S3_OBJECT_LIFECYCLE_DAYS를 바꾼다.
echo "[init-minio] 라이프사이클 설정: ${LIFECYCLE_DAYS}일 후 만료"
mc ilm rule remove --all --force "local/$BUCKET" >/dev/null 2>&1 || true
mc ilm rule add --expire-days "$LIFECYCLE_DAYS" "local/$BUCKET"

echo "[init-minio] 완료. 적용된 설정:"
mc encrypt info "local/$BUCKET" || true
mc ilm rule ls "local/$BUCKET" || true

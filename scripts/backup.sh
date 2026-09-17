#!/bin/sh
# Backup database Postgres — roadmap Phase 6 "Keamanan & Deployment: backup
# & disaster recovery". Dijalankan LEWAT container `postgres` (docker
# compose exec), bukan `pg_dump` di host, supaya versi client selalu cocok
# dengan versi server (image `postgres:16-alpine` di docker-compose.yml)
# tanpa bergantung apa yang terinstall di mesin yang menjalankan script ini.
#
# Pemakaian:
#   ./scripts/backup.sh
#
# Env yang dibaca (dari .env di root project, sama seperti docker-compose.yml):
#   DB_USERNAME, DB_DATABASE (wajib)
#
# Output: backups/hr_backend_<timestamp>.sql.gz (format plain SQL, di-gzip)
# — dipilih di atas format custom (-Fc) supaya bisa dibaca manusia/di-diff
# saat audit, dengan trade-off restore sedikit lebih lambat untuk database
# besar (di luar cakupan ukuran yang ditargetkan roadmap ini).
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/backups"

if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$PROJECT_ROOT/.env"
  set +a
fi

: "${DB_USERNAME:?DB_USERNAME wajib diisi di .env}"
: "${DB_DATABASE:?DB_DATABASE wajib diisi di .env}"

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT_FILE="$BACKUP_DIR/hr_backend_${TIMESTAMP}.sql.gz"

echo "[backup] Dump database '$DB_DATABASE' dari container postgres..."
docker compose -f "$PROJECT_ROOT/docker-compose.yml" exec -T postgres \
  pg_dump -U "$DB_USERNAME" -d "$DB_DATABASE" --no-owner --no-privileges \
  | gzip > "$OUTPUT_FILE"

echo "[backup] Selesai: $OUTPUT_FILE ($(du -h "$OUTPUT_FILE" | cut -f1))"

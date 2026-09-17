#!/bin/sh
# Restore database Postgres dari hasil scripts/backup.sh — roadmap Phase 6
# "backup & disaster recovery". SENGAJA dibuat & didokumentasikan bersama
# backup.sh: backup yang belum pernah dicoba di-restore bukan backup yang
# bisa diandalkan.
#
# PERINGATAN: script ini MENIMPA seluruh isi database tujuan (drop +
# recreate schema public sebelum restore) — jangan jalankan ke database
# production yang masih dipakai tanpa konfirmasi eksplisit.
#
# Pemakaian:
#   ./scripts/restore.sh backups/hr_backend_20260101T000000Z.sql.gz
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$PROJECT_ROOT/.env"
  set +a
fi

: "${DB_USERNAME:?DB_USERNAME wajib diisi di .env}"
: "${DB_DATABASE:?DB_DATABASE wajib diisi di .env}"

BACKUP_FILE="${1:?Pemakaian: ./scripts/restore.sh <path-file-backup.sql.gz>}"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "[restore] File tidak ditemukan: $BACKUP_FILE" >&2
  exit 1
fi

echo "[restore] AKAN MENIMPA seluruh isi database '$DB_DATABASE'. Lanjutkan? (ketik 'ya' untuk konfirmasi)"
read -r CONFIRMATION
if [ "$CONFIRMATION" != "ya" ]; then
  echo "[restore] Dibatalkan."
  exit 1
fi

echo "[restore] Drop & recreate schema public..."
docker compose -f "$PROJECT_ROOT/docker-compose.yml" exec -T postgres \
  psql -U "$DB_USERNAME" -d "$DB_DATABASE" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "[restore] Restore dari $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | docker compose -f "$PROJECT_ROOT/docker-compose.yml" exec -T postgres \
  psql -U "$DB_USERNAME" -d "$DB_DATABASE"

echo "[restore] Selesai."

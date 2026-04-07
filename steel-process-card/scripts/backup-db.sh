#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_FILE="${SQLITE_FILE_PATH:-$ROOT_DIR/server/data/process-cards.sqlite}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_FILE" ]; then
  echo "Database file not found: $DB_FILE" >&2
  exit 1
fi

STAMP="$(date '+%Y%m%d-%H%M%S')"
TARGET_FILE="$BACKUP_DIR/process-cards-$STAMP.sqlite"

cp "$DB_FILE" "$TARGET_FILE"
find "$BACKUP_DIR" -type f -name 'process-cards-*.sqlite' -mtime +"$RETENTION_DAYS" -delete

echo "Backup created: $TARGET_FILE"

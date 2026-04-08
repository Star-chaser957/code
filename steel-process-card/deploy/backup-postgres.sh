#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/docker-backups"
TIMESTAMP="$(date +%F_%H-%M-%S)"
OUTPUT_FILE="${BACKUP_DIR}/process_card_${TIMESTAMP}.dump"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "${BACKUP_DIR}"

docker exec steel-process-card-postgres pg_dump -U postgres -d process_card -Fc > "${OUTPUT_FILE}"

find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'process_card_*.dump' -mtime +"$((RETENTION_DAYS - 1))" -delete

echo "Backup created: ${OUTPUT_FILE}"
echo "Old backups older than ${RETENTION_DAYS} days have been cleaned."

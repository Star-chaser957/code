#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/xh/apps/steel-process-card}"
APP_NAME="$(basename "$APP_DIR")"
APP_PARENT_DIR="$(dirname "$APP_DIR")"
DEPLOY_DIR="${APP_DIR}/deploy"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.yml"
SOURCE_ARCHIVE="${1:-/tmp/steel-process-card-deploy-current.tgz}"
IMAGE_ARCHIVE="${2:-/tmp/steel-process-card-app-current.tar}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1/api/health}"
MAX_RETRIES="${MAX_RETRIES:-30}"
SLEEP_SECONDS="${SLEEP_SECONDS:-2}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${APP_PARENT_DIR}/deploy_backup_${TIMESTAMP}"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Compose file not found: ${COMPOSE_FILE}" >&2
  exit 1
fi

if [[ ! -f "${SOURCE_ARCHIVE}" ]]; then
  echo "Source archive not found: ${SOURCE_ARCHIVE}" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

tar -czf "${BACKUP_DIR}/source_before_update.tgz" \
  --exclude="${APP_NAME}/deploy/docker-data" \
  --exclude="${APP_NAME}/deploy/docker-backups" \
  -C "${APP_PARENT_DIR}" \
  "${APP_NAME}"

tar -xzf "${SOURCE_ARCHIVE}" -C "${APP_DIR}"

if [[ -f "${IMAGE_ARCHIVE}" ]]; then
  docker load -i "${IMAGE_ARCHIVE}"
fi

docker compose -f "${COMPOSE_FILE}" up -d --no-build --force-recreate app

for ((i = 1; i <= MAX_RETRIES; i++)); do
  if curl -fsS "${HEALTH_URL}" >/tmp/steel-process-card-health.json 2>/dev/null; then
    echo "Health check passed:"
    cat /tmp/steel-process-card-health.json
    echo
    rm -f /tmp/steel-process-card-health.json
    echo "Source backup: ${BACKUP_DIR}/source_before_update.tgz"
    exit 0
  fi

  sleep "${SLEEP_SECONDS}"
done

echo "Health check failed after ${MAX_RETRIES} attempts." >&2
docker compose -f "${COMPOSE_FILE}" ps >&2
docker logs --tail 200 steel-process-card-app >&2 || true
exit 1

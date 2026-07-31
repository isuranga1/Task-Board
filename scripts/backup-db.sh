#!/bin/bash
# Postgres backup. Dumps the DB from the running `db` container, keeps a
# rotating local window on the Pi, and (optionally) pushes a copy off the
# Pi — to Google Drive and/or another device on your tailnet — so losing
# the Pi (SD card failure, theft, whatever) doesn't mean losing the data.
#
# Each off-Pi destination is opt-in via backup.env (BACKUP_TO_GDRIVE /
# BACKUP_TO_REMOTE). Running this on a schedule (cron) is itself optional —
# it's just as safe to run by hand whenever you want a fresh backup.
#
# One-time setup: cp backup.env.example backup.env, fill it in, see
# DEPLOY.md "Backups" section for the rclone/SSH-key setup for whichever
# destination(s) you enable.
set -euo pipefail
cd "$(dirname "$0")/.."   # repo root — docker compose needs docker-compose.yml + .env here

# shellcheck source=/dev/null
source ./.env
# shellcheck source=/dev/null
source ./backup.env

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOCAL_DIR="./backups"
FILENAME="task_dashboard-${TIMESTAMP}.sql.gz"
mkdir -p "$LOCAL_DIR"

echo "==> Dumping database..."
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$LOCAL_DIR/$FILENAME"
echo "==> Wrote $LOCAL_DIR/$FILENAME ($(du -h "$LOCAL_DIR/$FILENAME" | cut -f1))"

ANY_OFFSITE_COPY=false

# ---------- Google Drive (rclone) ----------
if [ "${BACKUP_TO_GDRIVE:-false}" = "true" ]; then
  echo "==> Uploading to Google Drive (${GDRIVE_REMOTE_NAME}:${GDRIVE_FOLDER})..."
  if rclone copy "$LOCAL_DIR/$FILENAME" "${GDRIVE_REMOTE_NAME}:${GDRIVE_FOLDER}/" --quiet; then
    echo "==> Google Drive upload OK"
    ANY_OFFSITE_COPY=true
    echo "==> Renewing: deleting Google Drive backups older than ${GDRIVE_RETENTION_DAYS} days..."
    rclone delete "${GDRIVE_REMOTE_NAME}:${GDRIVE_FOLDER}/" --min-age "${GDRIVE_RETENTION_DAYS}d" --quiet
  else
    echo "!! Google Drive upload FAILED — check 'rclone config show ${GDRIVE_REMOTE_NAME}' / network"
  fi
fi

# ---------- Another device on the tailnet (scp) ----------
if [ "${BACKUP_TO_REMOTE:-false}" = "true" ]; then
  SCP_IDENTITY_ARGS=()
  if [ -n "${BACKUP_SSH_KEY:-}" ]; then
    SCP_IDENTITY_ARGS=(-i "$BACKUP_SSH_KEY")
  fi

  echo "==> Copying to ${BACKUP_REMOTE_HOST}..."
  if scp "${SCP_IDENTITY_ARGS[@]}" -o ConnectTimeout=10 -o BatchMode=yes \
      "$LOCAL_DIR/$FILENAME" "${BACKUP_REMOTE_USER}@${BACKUP_REMOTE_HOST}:${BACKUP_REMOTE_PATH}/"; then
    echo "==> Remote copy OK"
    ANY_OFFSITE_COPY=true
  else
    echo "!! Remote copy FAILED — is ${BACKUP_REMOTE_HOST} awake and reachable on the tailnet?"
  fi
fi

if [ "$ANY_OFFSITE_COPY" = "false" ]; then
  echo "!! No off-Pi copy made this run — $FILENAME only exists locally on the Pi for now."
  echo "!! Enable BACKUP_TO_GDRIVE and/or BACKUP_TO_REMOTE in backup.env, or the next"
  echo "!! successful run will still catch up (local copy is kept for ${LOCAL_RETENTION_DAYS} days)."
fi

echo "==> Pruning local backups older than ${LOCAL_RETENTION_DAYS} days..."
find "$LOCAL_DIR" -name "task_dashboard-*.sql.gz" -mtime "+${LOCAL_RETENTION_DAYS}" -delete

echo "==> Done: $FILENAME"

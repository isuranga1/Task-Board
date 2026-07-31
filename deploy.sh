#!/bin/bash
# Run this ON the Raspberry Pi, from the repo root (or point CI at it — see
# .github/workflows/deploy.yml). Brings the running stack up to date with
# origin/main: pulls latest code, rebuilds changed images, restarts, applies
# any new DB migrations (handled automatically by backend/entrypoint.sh).
#
# Assumes this clone is dedicated to deployment (no local edits worth
# keeping) — `git reset --hard` will discard anything uncommitted here.
set -e
cd "$(dirname "$0")"

echo "==> Pulling latest code..."
git fetch origin
git reset --hard origin/main

echo "==> Rebuilding and restarting containers..."
docker compose up -d --build

echo "==> Cleaning up old images..."
docker image prune -f

echo "==> Done. Current status:"
docker compose ps

#!/usr/bin/env bash
# Upload website/ to appship.ketchsoft.com.
# Usage: scripts/deploy-website.sh [--dry-run]
# The nginx server block lives in deploy/nginx/ and only needs installing once.
set -euo pipefail

HOST="${APPSHIP_WEB_HOST:-root@appship.ketchsoft.com}"
KEY="${APPSHIP_WEB_KEY:-$HOME/.ssh/id_ed25519_ketchsoft_deploy}"
REMOTE_DIR="${APPSHIP_WEB_DIR:-/var/www/html/appship}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new)
# -rtz, not -a: keep server-side ownership (root) instead of copying the local uid.
# macOS ships openrsync, which has no --chmod, so permissions are fixed after the copy.
FLAGS=(-rtvz --delete --exclude .DS_Store)
DRY=false
[[ "${1:-}" == "--dry-run" ]] && FLAGS+=(--dry-run) && DRY=true

rsync "${FLAGS[@]}" -e "${SSH[*]}" "$ROOT/website/" "$HOST:$REMOTE_DIR/"
$DRY || "${SSH[@]}" "$HOST" "chmod -R u=rwX,go=rX '$REMOTE_DIR'"

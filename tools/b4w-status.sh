#!/usr/bin/env bash
set -euo pipefail

# b4w-status.sh
# Shows what battle-for-wordle is configured to run (env tags) and what's actually running on knapp.
#
# Usage:
#   ./b4w-status.sh

KNAPP_HOST="knapp"
APP_DIR="/home/hunter/apps/battleforwordle"
ENV_FILE="$APP_DIR/.env"

ssh "$KNAPP_HOST" "set -euo pipefail;
  echo '== .env tags ==';
  if [ -f '$ENV_FILE' ]; then
    grep -E '^(B4W_PROD_TAG|B4W_TEST_TAG)=' '$ENV_FILE' || true;
  else
    echo 'missing: $ENV_FILE';
  fi;
  echo;
  echo '== docker compose ps ==';
  cd '$APP_DIR';
  docker compose ps || true;
  echo;
  echo '== container images ==';
  docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E '^b4w-' || true;"

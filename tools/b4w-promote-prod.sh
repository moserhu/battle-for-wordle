#!/usr/bin/env bash
set -euo pipefail

# b4w-promote-prod.sh
# Waits for main publish workflow to succeed, then updates knapp prod tag.
# Default is DRY RUN on knapp (no deploy) unless you pass --apply.
#
# Usage:
#   ./b4w-promote-prod.sh [--apply]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WAIT="$SCRIPT_DIR/b4w-wait-build.sh"
KNAPP_HOST="knapp"
KNAPP_SCRIPT="/home/hunter/apps/battleforwordle/b4w-set-prod-tag.sh"

APPLY="${1:-}"

TAG_LINE="$($WAIT --main)"
TAG="${TAG_LINE#TAG=}"

echo "Resolved PROD tag: $TAG (latest successful main publish run)" >&2

echo "Running on knapp: $KNAPP_SCRIPT $TAG ${APPLY:-}" >&2
ssh "$KNAPP_HOST" "$KNAPP_SCRIPT $TAG ${APPLY:-}"

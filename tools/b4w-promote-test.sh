#!/usr/bin/env bash
set -euo pipefail

# b4w-promote-test.sh
# Waits for PR publish workflow to succeed, then updates knapp test tag.
# Default is DRY RUN on knapp (no deploy) unless you pass --apply.
#
# Usage:
#   ./b4w-promote-test.sh --pr <number> [--apply]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WAIT="$SCRIPT_DIR/b4w-wait-build.sh"
KNAPP_HOST="knapp"
KNAPP_SCRIPT="/home/hunter/apps/battleforwordle/b4w-set-test-tag.sh"

if [[ "${1:-}" != "--pr" || -z "${2:-}" ]]; then
  echo "usage: $0 --pr <number> [--apply]" >&2
  exit 2
fi
PR="$2"
APPLY="${3:-}"

TAG_LINE="$($WAIT --pr "$PR")"
TAG="${TAG_LINE#TAG=}"

echo "Resolved TEST tag: $TAG (from PR $PR)" >&2

echo "Running on knapp: $KNAPP_SCRIPT $TAG ${APPLY:-}" >&2
ssh "$KNAPP_HOST" "$KNAPP_SCRIPT $TAG ${APPLY:-}"

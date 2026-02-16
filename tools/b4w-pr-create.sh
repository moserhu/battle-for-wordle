#!/usr/bin/env bash
set -euo pipefail

# b4w-pr-create.sh
# Creates a branch, commits ALL current changes, pushes, and opens a PR.
# PR-only workflow; does not merge.
#
# Usage:
#   ./b4w-pr-create.sh "feat: description" [branch-suffix]
#
# Notes:
# - Run this from the repo root.
# - It commits all staged+unstaged changes (git add -A).

OWNER="moserhu"
REPO="battle-for-wordle"
BASE_BRANCH="main"

PAT_FILE="/home/huntermoser/.openclaw/workspace/secrets/github.pat"
if [[ ! -f "$PAT_FILE" ]]; then
  echo "error: missing PAT file at $PAT_FILE" >&2
  exit 1
fi
PAT="$(cat "$PAT_FILE")"

if [[ $# -lt 1 ]]; then
  echo "usage: $0 \"type: message\" [branch-suffix]" >&2
  exit 2
fi
TITLE="$1"
SUFFIX="${2:-}"

# basic slug
slug=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g' | cut -c1-40)
if [[ -n "$SUFFIX" ]]; then
  slug="${slug}-${SUFFIX}"
fi
BRANCH="rhaegar/${slug}"

# ensure clean base
git rev-parse --is-inside-work-tree >/dev/null

git fetch origin "$BASE_BRANCH"
git checkout "$BASE_BRANCH"
git pull --ff-only origin "$BASE_BRANCH"

git checkout -b "$BRANCH"

git add -A
if git diff --cached --quiet; then
  echo "nothing to commit" >&2
  exit 1
fi

git commit -m "$TITLE"
git push -u origin "$BRANCH"

# Create PR via GitHub API
head="$BRANCH"
base="$BASE_BRANCH"

payload=$(python3 - <<PY
import json
print(json.dumps({"title": """$TITLE""", "head": "$head", "base": "$base", "body": "Opened by Rhaegar"}))
PY
)

resp=$(curl -sS -m 30 \
  -H "Authorization: Bearer $PAT" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  -d "$payload" \
  "https://api.github.com/repos/$OWNER/$REPO/pulls")

python3 - <<'PY'
import json,sys
r=json.load(sys.stdin)
if 'html_url' not in r:
    print('PR create failed:', r)
    raise SystemExit(1)
print('PR:', r['number'])
print(r['html_url'])
PY <<<"$resp"

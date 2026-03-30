#!/usr/bin/env bash
set -euo pipefail

# b4w-wait-build.sh
# Waits for the battle-for-wordle publish workflow to finish, then prints the deploy tag.
#
# Usage:
#   ./b4w-wait-build.sh --pr <number>   # waits for PR run, prints TAG=<pr_number>
#   ./b4w-wait-build.sh --main          # waits for main run, prints TAG=<sha>
#
# Env:
#   GITHUB_PAT_FILE (default: workspace/secrets/github.pat)
#   POLL_SECONDS (default: 25)
#   TIMEOUT_SECONDS (default: 1800)

OWNER="moserhu"
REPO="battle-for-wordle"
WORKFLOW_FILE="publish.yaml"

POLL_SECONDS="${POLL_SECONDS:-25}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-1800}"

DEFAULT_PAT_FILE="/home/huntermoser/.openclaw/workspace/secrets/github.pat"
GITHUB_PAT_FILE="${GITHUB_PAT_FILE:-$DEFAULT_PAT_FILE}"

MODE=""
PR_NUMBER=""

if [[ $# -lt 1 ]]; then
  echo "usage: $0 --pr <number> | --main" >&2
  exit 2
fi

case "${1:-}" in
  --pr)
    MODE="pr"
    PR_NUMBER="${2:-}"
    if ! [[ "$PR_NUMBER" =~ ^[0-9]+$ ]]; then
      echo "error: --pr requires a numeric PR number" >&2
      exit 2
    fi
    ;;
  --main)
    MODE="main"
    ;;
  *)
    echo "usage: $0 --pr <number> | --main" >&2
    exit 2
    ;;
esac

if [[ ! -f "$GITHUB_PAT_FILE" ]]; then
  echo "error: GITHUB PAT file not found: $GITHUB_PAT_FILE" >&2
  exit 1
fi
PAT="$(cat "$GITHUB_PAT_FILE")"

api() {
  local url="$1"
  curl -sS -m 20 \
    -H "Authorization: Bearer $PAT" \
    -H "Accept: application/vnd.github+json" \
    "$url"
}

# Find the most recent run id for this workflow in the desired context.
get_latest_run_json() {
  # We use the workflow runs endpoint by workflow file name.
  # https://api.github.com/repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs
  local base="https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs"

  if [[ "$MODE" == "main" ]]; then
    api "${base}?branch=main&per_page=5"
  else
    # For PRs, filter by event=pull_request, then pick the run whose pull_requests includes our number.
    api "${base}?event=pull_request&per_page=20"
  fi
}

select_run_id() {
  python3 - <<'PY'
import json, os, sys
mode=os.environ['MODE']
pr=os.environ.get('PR_NUMBER')
data=json.load(sys.stdin)
runs=data.get('workflow_runs',[])
if mode=='main':
    if not runs:
        print('')
        raise SystemExit(0)
    print(runs[0].get('id','') or '')
    raise SystemExit(0)

# PR mode: find first run that references this PR number
prn=int(pr)
for r in runs:
    for pr in r.get('pull_requests',[]) or []:
        if pr.get('number')==prn:
            print(r.get('id','') or '')
            raise SystemExit(0)
print('')
PY
}

get_run_details() {
  local run_id="$1"
  api "https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${run_id}"
}

echo "Watching ${OWNER}/${REPO} workflow ${WORKFLOW_FILE} (mode=${MODE})" >&2
[[ "$MODE" == "pr" ]] && echo "PR: ${PR_NUMBER}" >&2

epoch_start=$(date +%s)
run_id=""

# First, locate the run.
while true; do
  json=$(get_latest_run_json)
  run_id=$(MODE="$MODE" PR_NUMBER="$PR_NUMBER" select_run_id <<<"$json")
  if [[ -n "$run_id" ]]; then
    break
  fi
  now=$(date +%s)
  if (( now - epoch_start > TIMEOUT_SECONDS )); then
    echo "timeout: could not find a matching workflow run" >&2
    exit 1
  fi
  echo "waiting for workflow run to appear..." >&2
  sleep "$POLL_SECONDS"
done

echo "Found run_id=${run_id}" >&2

# Then, poll until completed.
while true; do
  details=$(get_run_details "$run_id")
  status=$(python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("status",""))' <<<"$details")
  conclusion=$(python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("conclusion",""))' <<<"$details")
  head_sha=$(python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("head_sha",""))' <<<"$details")

  echo "status=${status} conclusion=${conclusion} sha=${head_sha}" >&2

  if [[ "$status" == "completed" ]]; then
    if [[ "$conclusion" != "success" ]]; then
      echo "workflow completed but not successful (conclusion=${conclusion})" >&2
      exit 1
    fi
    break
  fi

  now=$(date +%s)
  if (( now - epoch_start > TIMEOUT_SECONDS )); then
    echo "timeout: workflow did not complete within ${TIMEOUT_SECONDS}s" >&2
    exit 1
  fi

  sleep "$POLL_SECONDS"
done

# Output deploy tag
if [[ "$MODE" == "main" ]]; then
  echo "TAG=${head_sha}"
else
  echo "TAG=${PR_NUMBER}"
fi

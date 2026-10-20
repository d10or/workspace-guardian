#!/usr/bin/env bash
# SessionStart hook: hands the living checkpoint and the last commits to every new or compacted session.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ctx="$(cat "$ROOT/docs/CHECKPOINT.md" 2>/dev/null)"
[ -z "$ctx" ] && exit 0
log="$(git -C "$ROOT" log --oneline -5 2>/dev/null || true)"
status="$(git -C "$ROOT" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
ctx="$ctx

## Repo at session start
Last commits:
$log
Uncommitted changes: $status file(s). If > 0, run git status before touching anything."
PY="$(command -v python3 || command -v python || true)"
if [ -z "$PY" ]; then printf '%s\n' "$ctx" >&2; exit 0; fi
printf '%s' "$ctx" | "$PY" -c '
import json, sys
print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": sys.stdin.read()}}))
'
exit 0

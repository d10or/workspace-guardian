#!/usr/bin/env bash
# Regression test for scripts/git-parallel-session-check.sh.
# It once printed nothing on macOS because it piped through `python`, which does not exist there.
set -euo pipefail
HOOK="$(cd "$(dirname "$0")/.." && pwd)/scripts/git-parallel-session-check.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }

cd "$TMP"
git init -q -b main .
git -c user.name=t -c user.email=t@t commit -q --allow-empty -m init
# a brand-new commit also trips the "HEAD moved recently" note, so back-date it
GIT_COMMITTER_DATE="2020-01-01T00:00:00" git -c user.name=t -c user.email=t@t commit -q --allow-empty --amend --no-edit --date "2020-01-01T00:00:00"

out="$(bash "$HOOK")"; code=$?
[ "$code" -eq 0 ] || fail "clean repo: exit $code"
[ -z "$out" ] || fail "clean repo should print nothing, got: $out"

echo x > staged.txt && git add staged.txt
out="$(bash "$HOOK")"; code=$?
[ "$code" -eq 0 ] || fail "staged repo: exit $code"
printf '%s' "$out" | grep -q '"hookEventName": "UserPromptSubmit"' || fail "staged repo: no hook JSON, got: $out"
printf '%s' "$out" | grep -q 'ALREADY STAGED' || fail "staged repo: warning missing, got: $out"
printf '%s' "$out" | python3 -I -c 'import json,sys; json.load(sys.stdin)' || fail "staged repo: output is not valid JSON"

touch .git/index.lock
out="$(bash "$HOOK")"
printf '%s' "$out" | grep -q 'index.lock' || fail "index.lock not reported"
rm .git/index.lock

echo "ok: hook prints nothing on a clean repo, valid JSON with warnings otherwise"

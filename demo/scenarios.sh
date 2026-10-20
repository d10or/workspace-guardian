#!/usr/bin/env bash
# Builds the three demo scenarios from the plan in a throwaway repo and prints the commands to show.
# Usage: bash demo/scenarios.sh [clean|risky|handoff|all]   (default: all)
# Nothing touches your own repositories. Needs git and node.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
GUARDIAN="node $HERE/src/index.ts"
DEMO="$(mktemp -d "${DEMO_TMP:-${TMPDIR:-/tmp}}/guardian-demo-XXXXXX")"
export GIT_AUTHOR_NAME=demo GIT_AUTHOR_EMAIL=demo@example.com GIT_COMMITTER_NAME=demo GIT_COMMITTER_EMAIL=demo@example.com

# DEMO_PAUSE=<seconds> slows the script down for recordings (default 0).
say() { printf '\n\033[1;36m$ %s\033[0m\n' "${*//$GUARDIAN/guardian}"; sleep "${DEMO_PAUSE:-0}"; }
run() { say "$*"; (cd "$CWD" && eval "$*"); sleep "${DEMO_PAUSE:-0}"; }

MAIN="$DEMO/app"; mkdir -p "$MAIN"
git -C "$DEMO" init -q -b main app
mkdir -p "$MAIN/src/auth" "$MAIN/src/api" "$MAIN/db/migrations"
printf 'export const login = () => "v1"\n' > "$MAIN/src/auth/login.ts"
printf 'export const users = () => []\n' > "$MAIN/src/api/users.ts"
printf 'create table users (id int);\n' > "$MAIN/db/migrations/0001_users.sql"
printf '{}\n' > "$MAIN/package-lock.json"
git -C "$MAIN" add -A && git -C "$MAIN" commit -q -m "initial app"
git -C "$MAIN" worktree add -q -b feature/auth "$DEMO/wt-auth"
git -C "$MAIN" worktree add -q -b feature/api "$DEMO/wt-api"

which="${1:-all}"
[ -n "${DEMO_QUIET:-}" ] || echo "demo repo: $MAIN  (worktrees: wt-auth, wt-api)"

if [ "$which" = clean ] || [ "$which" = all ]; then
  echo; echo "================ scenario 1: clean repo, two well-separated tasks ================"
  CWD="$MAIN"
  run "$GUARDIAN task add --id AUTH --paths 'src/auth/**' --branch feature/auth --note 'password reset' --yes"
  run "$GUARDIAN task add --id API --paths 'src/api/**' --branch feature/api --note 'users endpoint' --yes"
  run "$GUARDIAN inspect"
  run "$GUARDIAN check"
fi

if [ "$which" = risky ] || [ "$which" = all ]; then
  echo; echo "================ scenario 2: risky overlap caught before merge ================"
  [ "$which" = risky ] && { CWD="$MAIN"; (cd "$MAIN" && $GUARDIAN task add --id AUTH --paths 'src/auth/**' --branch feature/auth --yes >/dev/null && $GUARDIAN task add --id API --paths 'src/api/**' --branch feature/api --yes >/dev/null); }
  printf 'export const login = () => "v2"\n' > "$DEMO/wt-auth/src/auth/login.ts"
  printf 'export const login = () => "api needs this"\n' > "$DEMO/wt-api/src/auth/login.ts"   # API edits AUTH's file
  printf 'alter table users add email text;\n' > "$DEMO/wt-api/db/migrations/0002_email.sql"
  printf 'alter table users add phone text;\n' > "$DEMO/wt-auth/db/migrations/0002_phone.sql"  # same migration number, different names
  printf '{"changed":1}\n' > "$DEMO/wt-api/package-lock.json"
  printf 'export const users = () => [1]\n' > "$DEMO/wt-api/src/api/users.ts"
  CWD="$DEMO/wt-auth"
  run "$GUARDIAN task add --id AUTH2 --paths 'src/auth/login.ts' --branch feature/auth2 --yes"
  run "$GUARDIAN check"
  say "guardian check --strict; echo exit=\$?"; (cd "$CWD" && { $GUARDIAN check --strict >/dev/null && echo "exit=0" || echo "exit=$?"; })
fi

if [ "$which" = handoff ] || [ "$which" = all ]; then
  echo; echo "================ scenario 3: evidence-based handoff ================"
  [ "$which" = handoff ] && { (cd "$MAIN" && $GUARDIAN task add --id AUTH --paths 'src/auth/**' --branch feature/auth --yes >/dev/null); printf 'v2\n' > "$DEMO/wt-auth/src/auth/login.ts"; }
  git -C "$DEMO/wt-auth" add -A && git -C "$DEMO/wt-auth" commit -q -m "auth: password reset"
  CWD="$DEMO/wt-auth"
  run "$GUARDIAN handoff --task AUTH"
  run "$GUARDIAN handoff --task AUTH --run 'node -e process.exit(0)' | head -12"
fi

[ -n "${DEMO_QUIET:-}" ] && rm -rf "$DEMO" || { echo; echo "demo files are under $DEMO (delete when done)"; }

#!/usr/bin/env bash
# UserPromptSubmit hook: report whether another session is already working in
# this git checkout, before Claude starts touching files.
#
# Why this exists: two Claude sessions sharing one working directory share the
# index, HEAD and the branch. A `git add` in one gets swept into the other's
# commit, and a `git checkout -b` moves the branch under the session that was
# already there. The fix is a separate `git worktree` (or a private
# GIT_INDEX_FILE), but only if the collision is noticed first — hence this runs
# automatically instead of relying on remembering.
#
# Prints nothing when there is nothing to report, so a quiet repo costs no
# context. Never fails the prompt: every path exits 0.

set -uo pipefail

command -v git >/dev/null 2>&1 || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

BRANCH="$(git symbolic-ref --short -q HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null || echo unborn)"
HEAD_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
GIT_COMMON="$(git rev-parse --git-common-dir 2>/dev/null || echo .git)"
THIS_WT="$(git rev-parse --show-toplevel 2>/dev/null || echo '')"

warnings=()
notes=()

# --- 1. Other worktrees ----------------------------------------------------
# --porcelain is line-oriented, so it survives the spaces these paths contain
# (for example "OneDrive - Some Company"); the human format does not.
# Claude Code locks the worktrees it owns with "locked claude session <name>
# (pid N)", which is a direct statement that a parallel session exists.
wt_path=""; wt_branch=""; wt_lock=""
flush_wt() {
    [ -z "$wt_path" ] && return 0
    if [ "$wt_path" != "$THIS_WT" ]; then
        if [ -n "$wt_branch" ] && [ "$wt_branch" = "$BRANCH" ]; then
            warnings+=("another worktree also has '$BRANCH' checked out: $wt_path")
        fi
        case "$wt_lock" in
            *"claude session"*)
                notes+=("parallel Claude session in a worktree: ${wt_lock#claude session } on '${wt_branch:-detached}'")
                ;;
        esac
    fi
    wt_path=""; wt_branch=""; wt_lock=""
}

while IFS= read -r line; do
    case "$line" in
        "worktree "*) flush_wt; wt_path="${line#worktree }" ;;
        "branch refs/heads/"*) wt_branch="${line#branch refs/heads/}" ;;
        "detached") wt_branch="" ;;
        "locked "*) wt_lock="${line#locked }" ;;
        "locked") wt_lock="(no reason given)" ;;
    esac
done < <(git worktree list --porcelain 2>/dev/null)
flush_wt

# --- 2. A git operation in flight right now --------------------------------
[ -f "$GIT_COMMON/index.lock" ] && warnings+=("git index.lock exists - a git command is running right now")
for f in MERGE_HEAD REBASE_HEAD CHERRY_PICK_HEAD; do
    [ -e "$GIT_COMMON/$f" ] && warnings+=("a git operation is mid-flight ($f exists)")
done

# --- 3. Work already sitting in the shared index ----------------------------
staged="$(git diff --cached --name-only 2>/dev/null | grep -c . || true)"
if [ "${staged:-0}" -gt 0 ]; then
    warnings+=("$staged file(s) are ALREADY STAGED - check whose they are before committing")
fi

# --- 4. Another Claude session in THIS same directory -----------------------
# The case that is invisible to `git worktree list`, and the one that actually
# bit us: two sessions in one checkout. Best-effort — Claude Code keeps one
# transcript per session under ~/.claude/projects/<sanitised-cwd>/.
proj_key="$(pwd -W 2>/dev/null || pwd)"
proj_key="$(printf '%s' "$proj_key" | sed 's/[^A-Za-z0-9]/-/g')"
proj_dir="$HOME/.claude/projects/$proj_key"
if [ -d "$proj_dir" ]; then
    live="$(find "$proj_dir" -maxdepth 1 -name '*.jsonl' -mmin -10 2>/dev/null | grep -c . || true)"
    if [ "${live:-0}" -gt 1 ]; then
        warnings+=("$live session transcripts here were written in the last 10 min - another Claude session is likely live in THIS directory")
    fi
fi

# --- 5. HEAD moved very recently -------------------------------------------
last_commit_epoch="$(git log -1 --format=%ct 2>/dev/null || echo 0)"
if [ "${last_commit_epoch:-0}" -gt 0 ]; then
    age=$(( $(date +%s) - last_commit_epoch ))
    # Narrow window and neutral wording: this also fires after our own commit,
    # so it states the fact and leaves the attribution open.
    [ "$age" -lt 300 ] && notes+=("HEAD moved $((age / 60))m ago ($HEAD_SHA) - confirm it was not another session")
fi

[ "${#warnings[@]}" -eq 0 ] && [ "${#notes[@]}" -eq 0 ] && exit 0

context="Shared-checkout status (branch $BRANCH @ $HEAD_SHA):"
for w in ${warnings[@]+"${warnings[@]}"}; do
    context="$context
- WARNING: $w"
done
for n in ${notes[@]+"${notes[@]}"}; do
    context="$context
- $n"
done
if [ "${#warnings[@]}" -gt 0 ]; then
    context="$context
- Treat this checkout as shared. Do NOT run git add / commit / checkout -b here
  without telling the user first: you would share another session's index and
  move its branch. Prefer a dedicated \`git worktree\`, or build commits with a
  private GIT_INDEX_FILE, and say which you chose."
fi

PY="$(command -v python3 || command -v python || true)"
[ -z "$PY" ] && { printf '%s\n' "$context" >&2; exit 0; }
printf '%s' "$context" | "$PY" -c '
import json, sys
ctx = sys.stdin.read().strip()
if ctx:
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit",
        "additionalContext": ctx,
    }}))
' 2>/dev/null || true

exit 0

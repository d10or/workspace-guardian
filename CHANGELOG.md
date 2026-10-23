# Changelog

## 0.17.1 (mod) — 2026-10-23
- The control-tower tab row wraps on narrow panes (desktop app and VS Code side panels); found live in the desktop app, where Messages/Usage/Actions/Notes were cut off.

## 0.2.1 (CLI) / 0.17.0 (mod) — 2026-10-23
- Windows support: CLI path comparisons are separator- and case-insensitive on Windows; `handoff --run` goes through the shell there so npm shims resolve; CI runs on windows-latest. Mod: PowerShell fallbacks for home/config detection, directory creation, transcript tail and process liveness; `python` fallback for `python3`; Windows-safe relative paths for holds and claims.

## 0.2.0 (CLI) — 2026-10-23
- `guardian pro install <tarball> | status | remove`: installs the paid package under the guardian home; validates it is a Workspace Guardian Pro archive first.
- `guardian license add|show|remove`: optional offline Pro key (Ed25519, public key embedded, never phones home).
- `check` loads the separate Pro package when a valid key is present: scored merge plan with rebase steps, `.guardian/policy.json` policies, framework hotspot packs. Without a key nothing changes except a one-line hint.
- Policy and hotspot files are read from the main worktree's `.guardian/`, like the task file.

## 0.1.1 (CLI) / 0.16.0 (mod) — 2026-10-23
- `guardian usage`: local, counts-only usage summary (activation and repeat use for the pilot); `GUARDIAN_NO_USAGE=1` disables, `--reset` deletes. The mod records session starts, ownership holds and task events the same way.
- Public repo relicensed from MIT to PolyForm Shield 1.0.0 (2026-10-20); paid features move to a private repository.
- Messages are written one file per session (mod 0.15.0).

## 0.1.0 — 2026-10-20

First public release.

### guardian CLI 0.1.0
- `inspect`: branch, head, base, every worktree with uncommitted / committed-since-base counts, locks, in-flight git operations, task ↔ worktree map.
- `task add|done|list`: task-level path ownership in `.guardian/tasks.json`, previewed and confirmed before writing, atomic write.
- `check`: declared overlaps, same path changed in two worktrees, paths owned by another task, paths outside a task's claim, hotspot categories (lockfiles, migrations, schemas, generated, routes, config), behind base, in-flight operations, unresolved conflicts, stale tasks; suggested merge order; `--strict` exits 3 on risks; `--json` with `schemaVersion: 1`.
- `handoff`: Markdown / JSON report with commits, changed paths, outside-claim marks, open risks, next steps; test evidence is `verified` only when guardian ran the tests (exit code + tree fingerprint), else `supplied, not verified` or `not verified`.

### session-agents mod 0.15.0
- `/task add|done|list` and `list_tasks`: task ownership shared across worktrees and sessions; an edit from another branch into an owned path is held and the user is asked.
- Per-session files for claims and messages (no cross-session write races).
- Prompt text shared with other sessions only behind an opt-in toggle (off by default).
- Glob semantics fixed (`**` matches zero directories); edits recorded only after they succeed; peer branch cached; pid validation.
- Everything from 0.13.0: `/sessions` pane, live session list, file claims, edit pause, peer messaging, usage and plan limits, notes, history.

### scripts
- `git-parallel-session-check.sh`: `UserPromptSubmit` hook warning about shared checkouts; fixed to work on macOS without `python`.

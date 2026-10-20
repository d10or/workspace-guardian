# Review: session-agents mod v0.13.0 and the shared-checkout guard hook

**Reviewed:** 2026-10-17 against Claude Code 2.1.302. Files: `plugins/session-agents/` and
`scripts/git-parallel-session-check.sh`.

## Verdict

This is a strong starting point and already covers three of the ten pain points in
`RESEARCH_G1.md` (P2 silent overwrites, P9 which session is where, and half of P3 ownership
claims). It is the only mod-based tool in this space, because mods have been generally available for
16 days. Adopt it as the interactive surface of Guardian. The gaps below are what turn it from a
"control tower" into the ownership-and-preflight product the research points at.

`claude plugin validate`: passes with warnings. `claude plugin test`: 6 of 6 pass.

## Status after G2 ticket 1 (2026-10-20, v0.14.0)

Done: finding 1 (task-level claims in `.guardian/tasks.json`, `/task add|done|list`, `list_tasks`
tool, system-prompt note, pane card), finding 2 (ownership violations hold the edit and ask the user
with Allow once / Allow for session / Deny; the soft retry remains only for the recent-edit
heuristic), finding 3 (edits recorded after `next(e)` succeeds), finding 5 (proper glob semantics,
shared by claims and tasks), finding 7 for the edit hook (`.catch` fail-open), finding 11 partial
(unit tests for glob, parse, violation, overlap; integration tests for hold, passthrough, command).
Tests: 15 passing.

**v0.14.1 (same day):** finding 4 done (each session writes only `claims/<session>.json`; the legacy
shared file is read-only for older versions), finding 6 regression test added (`tests/hook.test.sh`,
runs the hook on a clean and a staged temp repo and checks the JSON), finding 9 (peer branch cached
15 s), finding 10 (prompt text shared only with the new "share my prompt text" toggle, off by
default), finding 11 pid validation. Live test on 2026-10-20: a task owning `docs/**` on another
branch held an edit from `main` and the user answered "Allow this task for the session"; the pause
was logged. **v0.15.0:** messages per session (finding 4 complete for the two contended files), timer guard, CI step
asserting `plugin.json` version = `VERSION`, README note for finding 8. All eleven findings closed
or consciously deferred (notes/pins/history stay shared: low traffic).

## Findings, most important first

### 1. Claims die with the session; Guardian needs claims that belong to a task
`addClaim` keys a claim by `sessionId` and both `addClaim` and the edit pause ignore claims whose
session is not alive (`alive.has(c.sessionId)`). A claim also expires after at most 480 minutes. That
is right for "I am editing this for an hour", but the research wedge (P3) is a task that may span
several sessions and days: `TASK-01 owns src/auth/** on feature/auth`. Add a second claim kind,
`task`, stored in the repo under `.guardian/tasks.json`, with no session binding and no expiry, and
have the edit pause check both. This is the single most valuable change.

### 2. The edit pause tells the model how to bypass it
`tool.call` denies the first edit and the deny text says "repeat the same edit and it will go
through". A model will simply retry, so the pause is a speed bump with little coordination value, and
`S.warned` makes every later edit to that file silent for 5 minutes. For ownership violations, hold
the call and ask the user instead (the `blast-radius` sample mod pattern: a band above the prompt
with Proceed / Cancel), or at least require the model to call `message_peer` or `list_peers` before
the retry is allowed. Keep the soft retry only for the "edited 3 minutes ago" heuristic.

### 3. Edits are recorded before they happen
In the `tool.call` hook, `S.files` and `S.editAt` are updated before `next(e)`. An edit the user
denies at the permission prompt, or that fails, still counts as "edited", and other sessions get
paused on it. Move the bookkeeping after `const ran = await next(e)` and skip it when `ran.deny` or
`ran.isError` is set.

### 4. Shared JSON files race (the README admits it)
`claims.json`, `messages.json`, `notes.json` etc. are read-modify-written by every session with no
locking, so two sessions claiming at the same moment lose one claim. For a tool whose purpose is
preventing silent overwrites this matters. Cheapest fix: one file per session (as `bus/` already
does) merged on read, so no cross-session write ever happens; or write to a temp file and rename.

### 5. `**` glob does not match zero directories
`claimMatches('src/**/x.ts', 'src/x.ts')` is false because `**` becomes `.*` between two literal
slashes. Standard glob semantics match it. Also `*` alone matches `[^/]*` but a pattern like
`src/*` will not match `src/a/b.ts`, which users may expect for a folder. Document or fix.

### 6. The shell hook never printed on this Mac
`git-parallel-session-check.sh` built its JSON with `python -c`. macOS has `python3` only, the call
failed inside `|| true`, and the hook silently exited 0 every time. Fixed in `scripts/`: it now
resolves `python3` or `python`, and prints the plain text to stderr if neither exists. Worth a
regression test because this was invisible by design.

### 7. Gating hooks have no `.catch`
The validator lists 14 gating hooks without a handler. If the general `tool.call` hook throws (for
example an atom read fails during reload) the hook is skipped and the edit goes through silently.
That is the right fail-open direction, but make it explicit with
`.catch(($, e, next) => next.called ? next(e) : next(e))` on the edit hook, and `{ deny }` handlers
on the four registered tools so a thrown error becomes a readable refusal.

### 8. `prompt.compose` is skipped under managed organizations
The validator notes that `prompt.compose` hooks do not run for plugins a person installs where an
organization manages Claude Code. The peer note is also available through `list_peers`, so this is
a graceful degradation, but say so in the README's known limits.

### 9. Polling cost on large repositories
Every 5 seconds the tick runs `git rev-parse` per peer and every 15 seconds `git status --porcelain`
for every worktree. On a large monorepo with several worktrees this is noticeable. Cache the branch
per peer cwd and re-run status only when the worktree's `.git` or index mtime changed.

### 10. Privacy of the heartbeat
Each session writes the first 100 characters of the user's prompt to `bus/<session>.json` and other
sessions read it. Prompts can contain secrets. Make the prompt field opt-in (default off) to meet the
plan's "avoid logging secrets" criterion, and keep the rest.

### 11. Small items
- `candidates.map(r => r.pid)` goes into `ps -p` without checking the value is an integer. The call is argv-based so there is no shell injection, but validate with `Number.isInteger`.
- `VERSION` is duplicated in `register.tsx` and `plugin.json`; read it from the manifest if the API exposes it, otherwise add a test that the two match.
- `$.clock.every(30000, usageTick)` is not guarded by `S.isTimerOn` while the 5-second tick is; make them consistent.
- Tests cover usage strings only. Add unit tests for `claimMatches`, `normPath`, and a `tool.call` deny test with seeded peers and claims. These are the core.
- `plugin.json` has no `author`; the validator warns, and the Anthropic directory requires attribution.

## What the mod already proves for the plan

- A `tool.call` hook can see every Edit/Write path in real time, which is the mechanism for preflight ownership checks (research section 4).
- Peer discovery through `<config>/sessions/*.json` and the `bus/` heartbeat works without any server.
- The pane, band, and toast surfaces draw correctly on the terminal (render test passes).

## Recommended order of work (feeds G2)

1. Task-level claims in `.guardian/` (finding 1), with the pause switched to ask-the-user for
   ownership violations (finding 2).
2. Record edits after success (3), per-session claim files (4), glob fix (5).
3. Tests for the core (11), `.catch` handlers (7).
4. Then start the `guardian` CLI on the same `.guardian/tasks.json`, so the CLI and the mod share one
   source of truth: `inspect` reads it, `check` compares it to `git diff --name-only` per worktree,
   `handoff` writes the report.

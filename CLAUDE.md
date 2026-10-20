# Workspace Guardian — project instructions for Claude Code

Read `docs/CHECKPOINT.md` first in every session (a SessionStart hook injects it). It is the living
state: current gate, what is in progress, decisions, next steps. `docs/PROGRESS.md` is the dated
history. `docs/MASTER_PLAN.md` is the source of truth for scope and gates; the tracker workbook
`docs/EXECUTION_TRACKER.xlsx` holds live statuses.

## What this is
One product, two surfaces, one shared file `.guardian/tasks.json`:
- `plugins/session-agents/` — Claude Code mod (`/sessions`, `/task`, edit hold, claims, peers).
- `src/` — `guardian` CLI (`inspect`, `task`, `check`, `handoff`). Read-only by default.
Rule that never bends: Guardian never merges, rebases, checks out, pushes, resets, or deletes.

## Working rules
- Tests before claims: `npm test`, `claude plugin test plugins/session-agents`, `bash tests/hook.test.sh`.
  Run them and quote the result; never report "passing" from memory.
- Node lives at `~/.nvm/versions/node/v24.22.0/bin` (nvm; new shells have it on PATH).
- Mod version: bump `VERSION` in `hooks/register.tsx` and `plugin.json` together (CI checks).
- Git: commit with the attribution line from the system reminder; push to `origin main`; CI must
  be green on ubuntu + macos + mod job. Tag releases `vX.Y.Z` and follow `docs/RELEASE_CHECKLIST.md`.
- Tracker edits use openpyxl (installed for the user); it drops conditional-formatting
  extensions on save, which is accepted.
- Evidence rules from the plan: never mark a gate or ticket done without a path, command output,
  or URL. G3–G6 close only on real testers, installs, buyers, and the dated decision.
- Outward-facing actions (posting, submitting, emailing, publishing to npm) are the founder's;
  draft them, do not send them.
- Use `/checkpoint` before ending a long piece of work and whenever context is about to compact;
  use `/resume` at the start of a session; use `/gate G3` to review a gate against its criteria.

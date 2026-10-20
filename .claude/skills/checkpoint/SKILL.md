---
name: checkpoint
description: Save the project's living state so a new session or a context compaction loses nothing. Use before ending a work block, before/after a milestone, when context is about to compact, or when the user says "checkpoint", "save state", "save progress".
user-invocable: true
disable-model-invocation: false
---

# /checkpoint [optional note]

Rewrite `docs/CHECKPOINT.md` so that a stranger with only that file could continue the work.
Keep it under 80 lines; it is injected into every session.

Current state to fold in:

Last commits: !`git log --oneline -5`
Working tree: !`git status --short | head -20`
Tests last known: !`grep -n "tests green\|green on last push" docs/CHECKPOINT.md | head -3`

## Steps
1. Read `docs/CHECKPOINT.md` and this session's work. Update every section:
   - header line (date, current gate, release),
   - **In progress / blocked** (what was started and exactly where it stopped, with file paths),
   - **Next engineering work** (ordered),
   - **Decisions that must not be re-litigated** (append any new decision with its date),
   - **State of the code** (test counts only from a run you made this session; otherwise write "not re-run this session"),
   - **Open questions for the founder**.
2. If something was completed this session, add a dated bullet to `docs/PROGRESS.md` with an evidence path, and set the matching Backlog row in `docs/EXECUTION_TRACKER.xlsx` (openpyxl; keep existing columns).
3. Commit: `checkpoint: <one line>` with the attribution line, and push. If the working tree holds unfinished code that must not be committed, commit only the docs and say what was left uncommitted in the checkpoint's "In progress" section.
4. Reply in three lines: what was saved, what is uncommitted, what the next session should do first.

Never write "done" without evidence. Never erase an older decision; mark it superseded with a date.

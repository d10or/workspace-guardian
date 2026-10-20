---
name: gate
description: Review one gate (G1–G6) of the master plan against its exit criteria and the evidence on disk, then update the tracker honestly. Use when the user says "gate review", "/gate G3", "can we close G4", "are we done with G2".
user-invocable: true
---

# /gate <G1..G6>

Plan criteria: !`awk '/^## 5\. Six-week gated/,/^\*\*Important/' docs/MASTER_PLAN.md`

Definition of done: !`awk '/^## 6\. Definition of done/,/^## 7\./' docs/MASTER_PLAN.md`

Progress log: !`sed -n 1,60p docs/PROGRESS.md`

## Steps
1. Take the gate named in `$ARGUMENTS`. List each exit criterion from the plan on its own line.
2. For each criterion write: **met** with a path, command output you ran now, or URL; **not met** with what is missing; or **needs external evidence** (testers, installs, buyers, a dated decision) that cannot be produced from inside a session.
3. Verdict: closed / not closed. A gate is closed only when every criterion is met with evidence. Never close G3–G6 without the real-world numbers; say plainly whose action is needed.
4. Update the Milestones row in `docs/EXECUTION_TRACKER.xlsx` (Status, Evidence, Decision/notes) and add a Decision Log row if the verdict changed. Add a dated bullet to `docs/PROGRESS.md`. Commit and push.
5. Reply with the criterion table and the verdict, nothing else.

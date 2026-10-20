---
name: resume
description: Rebuild working context at the start of a session or after compaction: read the checkpoint, progress log, git state and CI, then state where things stand and the first action. Use when the user says "resume", "where were we", "continue", or at the beginning of a session on this project.
user-invocable: true
---

# /resume

Checkpoint: !`cat docs/CHECKPOINT.md`

Recent progress: !`sed -n 1,40p docs/PROGRESS.md`

Git: !`git log --oneline -8` 
Working tree: !`git status --short | head -20`
CI: !`gh run list --branch main --limit 3 --json headSha,conclusion,createdAt --jq '.[] | "\(.headSha[0:7]) \(.conclusion) \(.createdAt)"' 2>/dev/null || echo "gh unavailable"`

## Steps
1. Reconcile the checkpoint with git and CI. If they disagree (a commit the checkpoint does not know, a red CI run, uncommitted files), say so first.
2. Report in this shape, under 15 lines: current gate and what closes it; what is in progress and exactly where it stopped; the first action to take now; open founder questions.
3. Do not start building until the user confirms the first action, unless they already asked for it in the same message.

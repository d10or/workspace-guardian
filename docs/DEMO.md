# Demo script (G2-09)

`bash demo/scenarios.sh` builds a throwaway repository with two worktrees and runs the three
scenarios the plan asks to record. Nothing touches your own repositories. Record each scenario as a
20 to 40 second terminal clip (asciinema, or a screen recording of the terminal).

| Clip | Command | What the viewer should see |
|---|---|---|
| 1. Clean repo | `bash demo/scenarios.sh clean` | Two tasks declared, `inspect` maps each to its worktree, `check` prints "no risks found". |
| 2. Risky overlap caught | `bash demo/scenarios.sh risky` | A declared overlap, the same file changed in two worktrees, a file owned by another task, two migrations under different names flagged as one hotspot, and `--strict` exiting 3. Each finding ends with a fix. |
| 3. Safe handoff | `bash demo/scenarios.sh handoff` | A handoff report that says **not verified**, then the same report after `--run` says **verified** with the exit code and tree fingerprint. |

For the Claude Code side, record a fourth clip inside Claude Code: `/task add AUTH 'src/auth/**' --branch feature/auth`
in one session, then an edit to `src/auth/...` from a session on `main`, showing the Allow / Deny question.

Suggested caption for all clips: "Guardian flags risk before you merge. It never merges, rebases, or pushes for you."

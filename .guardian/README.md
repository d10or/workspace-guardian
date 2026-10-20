# .guardian/

Local, per-repository state for Guardian (task claims, generated reports).
Everything in this directory except this README is git-ignored.
Guardian only writes here after an explicit, previewed write command.

`tasks.json` is the shared task-ownership file written by the session-agents mod (`/task add`) and,
later, by `guardian task add`. It is kept in the main worktree so all worktrees see it.

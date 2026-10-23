# Privacy statement

Workspace Guardian runs entirely on your machine.

- **No network.** Neither the CLI nor the mod opens a connection. There is no account, no API key, no telemetry, no crash reporting.
- **What the CLI reads:** your Git repository through read-only `git` commands, and `.guardian/tasks.json`.
- **What the CLI writes:** `.guardian/tasks.json` in the main worktree (only `task add` / `task done`, after a preview), and a report file only when you pass `--out`.
- **What the mod reads:** Claude Code's own session list and transcripts under your Claude config folder (to show what each session is doing), your repository through read-only `git` commands, and `.guardian/tasks.json`.
- **What the mod writes:** `.guardian/tasks.json`, and its own files under `<claude config>/session-agents/` (notes, pins, history, preferences, one claims file and one messages file per session, a heartbeat per session). File paths you edit and messages you send between sessions are stored there in plain text. The first line of your prompt is shared with other sessions only if you turn on "share my prompt text" (off by default).
- **Usage counts:** both the CLI and the mod keep local counters under `<claude config>/guardian/usage/` (which command ran on which day, how many times; never a path, branch, task id, or content). They exist so you can show activation and repeat use if you choose to: `guardian usage` prints them. Nothing reads them but you. Disable with `GUARDIAN_NO_USAGE=1`; delete with `guardian usage --reset`.
- **Secrets:** nothing reads `.env` files or file contents for its own purposes. `handoff --run` captures the last 15 lines of your test command's output into the report; check them before sharing a report.
- **Deleting everything:** remove `.guardian/` from your repository and `<claude config>/session-agents/`.

If you believe the tool sent data anywhere or wrote outside these locations, open a bug report marked "Safety" first.

# Install, update, uninstall

Everything runs locally. No account, no API key, no network access.

## Platforms

| | CLI | mod | hook |
|---|---|---|---|
| macOS | yes (CI) | yes | yes |
| Linux | yes (CI) | yes (CI) | yes |
| Windows 10/11 | yes (CI); needs Git for Windows and Node 22+; `tar` ships with Windows | yes from 0.17.0 (PowerShell is used where Unix tools are missing); Jump to terminal is macOS-only | runs under Git Bash: point the settings command at `"C:\\Program Files\\Git\\bin\\bash.exe"` |

## session-agents mod (Claude Code 2.1.287 or later)

Install from this repository's marketplace:

```
/plugin install session-agents --marketplace d10or/workspace-guardian
```

Answer `y` to add the marketplace, then pick a scope (user is the usual choice). Start a new
session or run `/reload-plugins`, then type `/sessions`. The last line of the pane shows the loaded
version.

From a local checkout instead:

```
claude plugin marketplace add /path/to/this/repo
claude plugin install session-agents@workspace-guardian
```

Update: `claude plugin marketplace update workspace-guardian` then
`claude plugin update session-agents@workspace-guardian`. Sessions already running keep the old
version until they restart.

Uninstall: `claude plugin uninstall session-agents@workspace-guardian`. The mod's own data stays in
`~/.claude/session-agents/` (or `$CLAUDE_CONFIG_DIR/session-agents/`) until you delete that folder.
Task declarations live in your repository at `.guardian/tasks.json`; delete the `.guardian/` folder
to remove them.

## guardian CLI (Node.js 22 or later, Git)

From a checkout:

```sh
npm install
npm run build
npm link          # puts `guardian` on your PATH, pointing at dist/
```

Or run without linking: `node dist/index.js <command>` or `npm run dev -- <command>`.

Uninstall: `npm unlink -g workspace-guardian` (or just delete the checkout). The CLI never writes
outside your repository's `.guardian/` folder.

## Shared-checkout hook (optional, bash + git)

Warns at every prompt when another session shares this checkout, a git operation is in flight, or
files are already staged.

```sh
mkdir -p ~/.claude/hooks
cp scripts/git-parallel-session-check.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/git-parallel-session-check.sh
```

Add to `~/.claude/settings.json`, merging into any existing `UserPromptSubmit` list:

```json
{ "hooks": { "UserPromptSubmit": [ { "hooks": [
  { "type": "command", "command": "bash \"$HOME/.claude/hooks/git-parallel-session-check.sh\"" }
] } ] } }
```

Uninstall: remove that entry and delete the script. Check it works with `bash tests/hook.test.sh`.

## Troubleshooting

- **`/task` or `/sessions` is "unknown skill":** the session started before the mod was installed. Restart it.
- **The pane is blank:** Claude Code prints a dim `session-agents: ...` line in the transcript naming the failing hook.
- **`guardian inspect` says "base unknown":** the repo has no `origin` and no `main`/`master`. Pass `--base <ref>`.
- **The hook prints nothing:** that is normal on a quiet repo. It needs `python3` or `python` for JSON output; without either it prints the warning as plain text on stderr.
- **Windows:** `handoff --run` runs your test command through `cmd.exe` so that `npm`/`npx` shims resolve; everything else is shell-free. If the mod shows no peers, confirm `powershell` and `tasklist` are on PATH (they are by default).

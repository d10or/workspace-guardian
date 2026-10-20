# session-agents

A control tower for people who run several Claude Code sessions at once.

Type `/sessions` and a pane shows what every session on your machine is doing, which files they are touching, how much of your context window and plan limits you have used, and gives the sessions a way to avoid stepping on each other.

Everything runs locally. There is no server, no account, and no network access.

## What you get

Open it with `/sessions` (also `/agents`). The pane has tabs:

| Tab | What it shows |
| --- | --- |
| **Overview** | Pinned sessions, active file claims, a "Needs attention" list, what is working right now, subagents |
| **Sessions** | One card per live session: status, branch, current task, last action, subagents, claims. Buttons: Jump, Pin, Message, Copy |
| **Git** | Worktrees (dirty or clean), branches already merged into the default branch |
| **History** | Sessions that finished, grouped by day, with how long they ran |
| **Messages** | Messages sent between sessions, and a line each time an edit was paused |
| **Usage** | Plan limits (5-hour / 7-day) with what is left, context window per session, token totals |
| **Actions** | Read-only git and system buttons, notification and behaviour settings |
| **Notes** | A small shared to-do list (`/note`) |

Also:

- A one-line band above the prompt: branch, dirty files, ahead/behind, number of sessions.
- Toasts when another session starts working, finishes, or needs you. Pinned sessions always notify.
- Warnings when a session's context passes 80% / 95%, or a plan window passes 80% / 95%.

## Commands

| Command | Does |
| --- | --- |
| `/sessions`, `/agents` | Open the pane |
| `/note <text>` | Save a note |
| `/tell <name> <text>` | Send a message to another session |
| `/claim [minutes] <path[,path...]> [note]` | Tell other sessions you are working on those files |
| `/release [path\|all]` | Release your claims |
| `/task add <ID> <path[,path...]> [--branch <name>] [note]` | Declare that a task owns those paths on a branch. Shared by every worktree of the repo, survives sessions ending |
| `/task done <ID>` | Mark a task done and release its paths |
| `/task list` | Show declared tasks and any overlaps between them |

## Tools the model can use

| Tool | Does |
| --- | --- |
| `list_peers` | List other live sessions: status, branch, directory, files they edit, claims |
| `message_peer(to, text)` | Send a short message to another session. Limited to 4 hops per exchange and 6 sends per 10 minutes |
| `claim_files(paths, note, minutes)` | Announce work on files or folders (`*` and `**` patterns work). Default 60 minutes, max 480 |
| `release_claims(paths)` | Release your claims |
| `list_tasks` | Declared task ownership for this repository and any declared overlaps |

Each session also gets a short note in its system prompt listing the other live sessions on the same git project and their claims, so it knows to coordinate before editing shared files.

## Install

You need Claude Code with plugin hooks ("mods"). It was built and tested on Claude Code 2.1.302.

```
claude plugin marketplace add https://github.com/d10or/workspace-guardian
claude plugin install session-agents@session-agents
```

Start a new session (or restart an existing one) and type `/sessions`. The last line of the pane shows the loaded version, so you can tell whether a session picked up an update.

To update:

```
claude plugin marketplace update session-agents
claude plugin update session-agents@session-agents
```

Sessions that were already running keep the old version until they restart.

To remove it: `claude plugin uninstall session-agents@session-agents`. Your saved data stays in `<claude config>/session-agents/` until you delete that folder.

## Requirements

- macOS or Linux. Windows is not supported (the plugin shells out to `sh`, `ps`, `tail`).
- `git` for the Git tab and branch information.
- `python3` (optional): used to total tokens from other sessions' transcripts. Without it, the Usage tab still shows plan limits and this session's context, and says so.
- iTerm2 or Terminal.app on macOS (optional): only for the **Jump** button. Elsewhere, or if you switch it off, Jump copies the command instead.
- `gh` (optional): only for the "Open PRs" button.

## What it reads and writes

It never sends anything off your machine. It reads:

- `<claude config>/sessions/*.json`: Claude Code's own list of running sessions.
- `<claude config>/projects/...`: session transcripts and subagent transcripts, to show each session's current task, last action, subagents, and token totals.
- Your git repository, with read-only git commands.

It writes task ownership to `<main worktree>/.guardian/tasks.json` in your repository, and everything else to `<claude config>/session-agents/` (`notes.json`, `history.json`, `pins.json`, `messages.json`, `prefs.json`, one claims file per session in `claims/`, one messages file per session in `messages/`, and a small heartbeat file per session in `bus/`). `<claude config>` is `$CLAUDE_CONFIG_DIR` if set, otherwise `~/.claude`.

Message text you send between sessions, and the file paths a session edits, are stored in those files in plain text. The first line of your prompt is shared with other sessions only if you switch on "share my prompt text" in the Actions tab (off by default).

## Task ownership

`/task add AUTH 'src/auth/**' --branch feature/auth` records that task AUTH owns everything under
`src/auth/` on branch `feature/auth`. The record lives in `<main worktree>/.guardian/tasks.json`, so
every worktree of the repository and every later session sees it. When a session on any other branch
tries to edit a path a task owns, the edit is held and you are asked: **Allow once**, **Allow this
task for the session**, or **Deny**. Dismissing the question denies. A task without a branch is
informational only. Adding a task whose paths overlap another active task warns immediately; the
Overview tab lists such overlaps under "Needs attention". Each session's system prompt also lists
the active tasks, so Claude knows the boundaries before it edits.

## The edit pause

If another session on the same project edited a file in the last 10 minutes, or has claimed it, the **first** attempt to edit it is refused with the reason and a hint to message that session. Repeating the same edit within 5 minutes goes through. It only sees edits made through Claude's edit tools by sessions that also run this plugin, and not changes made by shell commands. Turn it off in **Actions** with "pause on files another session just edited".

## Settings

In the **Actions** tab: pane theme (light page by default, readable on any terminal theme), notification kinds, the edit pause, and whether Jump may switch terminal tabs. Settings are saved and shared by all sessions.

## Known limits

- Other sessions' context window size is estimated (marked `~`); only the current session reports its exact window.
- Dollar cost is shown for the current session only.
- Token totals count what each transcript recorded, and are approximate.
- A subagent counts as active if its transcript changed in the last minute.
- Claims and messages are written one file per session, so sessions never overwrite each other's. Notes, pins and history are low-traffic shared files still written without locking.
- The peer note in the system prompt does not run for plugins a person installs where an organization manages Claude Code; `list_peers` and `list_tasks` still work there.

## Troubleshooting

- **Pane is blank or a tab does nothing:** Claude Code prints a one-line `session-agents: ... refused/threw ...` notice in the transcript. That line names the failing spot.
- **A command is "unknown skill":** that session started before you installed the plugin. Restart it.
- **Jump does nothing on macOS:** allow the terminal to control iTerm2 / Terminal in System Settings, Privacy & Security, Automation, or switch Jump off.

## Development

```
claude plugin validate plugins/session-agents
claude plugin test plugins/session-agents
```

The test kit cannot seed the pane's saved state, so the data-driven tabs are checked by opening the pane. When changing the code, do not name a variable `h` in the pane code: the mod's JSX compiles into calls to a global `h`, and shadowing it blanks the pane.

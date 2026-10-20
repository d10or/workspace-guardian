# Private alpha guide (G3)

Thank you for trying Workspace Guardian. This takes about 20 minutes. Everything runs on your
machine; nothing is sent anywhere. Please do the steps on a **real project of yours**, in a
branch you can throw away, and tell us what happened, including where it was confusing.

## What you need

- macOS or Linux, Git, Node.js 22 or later, Claude Code 2.1.287 or later.
- A repository where you already run, or want to run, two Claude Code sessions at once.

## Install (5 minutes)

```
/plugin install session-agents --marketplace d10or/workspace-guardian
```

Answer `y` to add the marketplace, choose user scope, then start a new Claude Code session.

For the CLI, in a terminal:

```sh
git clone https://github.com/d10or/workspace-guardian && cd workspace-guardian
npm install && npm run build && npm link
guardian --help
```

## The guided two-task workflow (15 minutes)

1. **Inspect.** In your repo: `guardian inspect`. Does it show your worktrees and branches correctly?
2. **Declare two tasks.** Pick two pieces of work you would hand to two sessions. In Claude Code:
   `/task add TASK-A 'path/to/area-a/**' --branch feature/a` and the same for TASK-B on another branch.
   Did the paths you typed match what you meant? Did it warn if they overlapped?
3. **Work in parallel.** Open a second Claude Code session in a worktree on `feature/b`
   (`claude --worktree feature-b` is enough). Have it make a change. Then ask it to edit a file
   inside TASK-A's paths. You should get an Allow / Deny question. Was the question clear?
4. **Check.** From either worktree: `guardian check`. Read every finding. For each one, tell us:
   true risk, false alarm, or unclear.
5. **Handoff.** `guardian handoff --task TASK-A --run '<your test command>'`. Is the report what you
   would want to read before merging? What is missing?
6. **Clean up.** `/task done TASK-A`, `/task done TASK-B`, delete the worktree.

## What we would like back (reply in the issue or message we sent you)

- Minutes spent, and where you got stuck.
- For each `check` finding: true / false / unclear.
- Usefulness 1 to 5, and the one thing that would make you use it on your next real project.
- Would you pay a small one-time price for a Pro version? What would it need to include?
- Anything that felt unsafe or surprising (a write you did not expect, a wrong warning).

## Uninstall

`claude plugin uninstall session-agents@workspace-guardian` and `npm unlink -g workspace-guardian`.
Delete `.guardian/` in your repo and `~/.claude/session-agents/` if you want nothing left.

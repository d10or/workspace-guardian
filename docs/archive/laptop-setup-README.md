# Claude Code setup for the new laptop (general only)

**This file is for Claude Code running on the new laptop.** Read it, then do the steps below with the user.

The user is replacing their laptop and wants to carry over only their *general* Claude Code setup. This folder deliberately contains nothing from any work project: no project skills, no project memory, no project settings, no credentials. Do not go looking for any on the old machine's behalf, and do not invent them.

Ground rules:

- Ask before changing `~/.claude/settings.json`. **Merge** into it; never overwrite it, because it may already contain hooks or plugins (for example the iTerm2 integration adds its own hooks).
- Never print or copy secrets.
- Do each step, then verify it, then tell the user what happened.

## What is in this folder

| File | What it is |
| --- | --- |
| `README.md` | These instructions |
| `git-parallel-session-check.sh` | A guard hook that warns when another Claude session is already working in the same git checkout (step 3) |

## Step 1 - Install six plugins

All six are listed in the official marketplace, `claude-plugins-official`. It is built into Claude Code; if `claude plugin marketplace list` does not show it, add it with `claude plugin marketplace add anthropics/claude-plugins-official`.

```
claude plugin install superpowers@claude-plugins-official
claude plugin install code-review@claude-plugins-official
claude plugin install feature-dev@claude-plugins-official
claude plugin install ralph-loop@claude-plugins-official
claude plugin install typescript-lsp@claude-plugins-official
claude plugin install claude-code-setup@claude-plugins-official
```

What each one gives the user:

| Plugin | What it does |
| --- | --- |
| **superpowers** | This is what shows the **"brainstorming"** step when the user hands Claude a task. It teaches Claude to brainstorm and ask clarifying questions before writing code, plus subagent-driven development with built-in code review, systematic debugging, and red/green TDD. It also helps Claude write and test new skills. **Third party:** it comes from `https://github.com/obra/superpowers.git`, not from Anthropic's own repository, though the official marketplace lists it. |
| **code-review** | Automated code review of pull requests using several specialised agents, with confidence scoring to filter out false positives. |
| **feature-dev** | A structured workflow for building a feature: specialised agents explore the codebase, design the architecture, and review quality. |
| **ralph-loop** | Iterative loops: Claude works on the same task repeatedly, seeing its previous work each time, until the task is complete (the "Ralph Wiggum" technique). Use it for tasks with a clear finish line. |
| **typescript-lsp** | TypeScript / JavaScript language server, for better code intelligence. **It needs the `typescript-language-server` program on the machine's PATH.** If it is missing, install it (for example `npm install -g typescript-language-server typescript`) and tell the user you did. |
| **claude-code-setup** | Analyses a codebase and recommends tailored Claude Code automations: hooks, skills, MCP servers and subagents. |

Not carried over, on purpose: `frontend-design`, `github`, `code-simplifier` and `atlassian` were turned **off** on the old laptop. Leave them uninstalled unless the user asks.

## Step 2 - Enable them in settings

`claude plugin install` normally enables the plugin for you. To be sure, check that `~/.claude/settings.json` contains these entries under `enabledPlugins`, and add any that are missing (merge, do not replace the whole object):

```json
{
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true,
    "code-review@claude-plugins-official": true,
    "feature-dev@claude-plugins-official": true,
    "ralph-loop@claude-plugins-official": true,
    "typescript-lsp@claude-plugins-official": true,
    "claude-code-setup@claude-plugins-official": true
  }
}
```

## Step 3 - Install the parallel-session guard hook

`git-parallel-session-check.sh` runs when the user submits a prompt and prints a short warning *only if* something looks risky; otherwise it prints nothing. It checks whether:

- another worktree has the same branch checked out, or a parallel Claude session is working in a worktree,
- a git operation is running right now (`index.lock`, merge, rebase or cherry-pick in progress),
- files are already staged in the shared index,
- another Claude session used this same directory in the last 10 minutes.

Why it matters: two sessions in one checkout share the index, `HEAD` and the branch, so one session's `git add` or `git checkout -b` can silently land in the other's work. The hook always exits 0, so it can never block a prompt. It needs only `bash`, `git`, `sed` and `find`.

Install it:

```
mkdir -p ~/.claude/hooks
cp git-parallel-session-check.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/git-parallel-session-check.sh
```

Then add this to `~/.claude/settings.json`. **Merge it into any existing `UserPromptSubmit` list** (the iTerm2 integration may already have added one) instead of replacing it:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          { "type": "command", "command": "bash \"$HOME/.claude/hooks/git-parallel-session-check.sh\"" }
        ]
      }
    ]
  }
}
```

(The one comment in the script that mentions an example path with spaces is harmless; it does not affect anything.)

## Step 4 - Verify

1. `claude plugin list` shows all six plugins as enabled.
2. Run `bash ~/.claude/hooks/git-parallel-session-check.sh` inside any git repository. It should print nothing, or a one-line warning, and exit 0 (`echo $?` prints `0`).
3. Start a new Claude Code session (plugins and hooks load when a session starts). Give it a small task and confirm the brainstorming step from **superpowers** appears.
4. Tell the user which steps passed and which, if any, need their attention.

## Not in this folder

Everything tied to the old laptop's work: project skills, project memory, the auto-mode rules, deployment details, MCP servers, `.env` files, SSH keys and logins. The user signs in to Claude Code and any other services fresh on the new machine.

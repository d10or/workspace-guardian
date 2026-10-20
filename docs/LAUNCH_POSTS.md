# Launch posts (G4-03) — drafts for the founder to post

Rules baked in: no claims we cannot show, no "saves you hours", no mention of pricing before G5.
Every post links the repo and the risky-overlap GIF. Post order: Reddit, then Show HN the same
day, then X. Reply to every comment within the day; log install-source mentions in the tracker.

Repo: https://github.com/d10or/workspace-guardian
GIF: https://raw.githubusercontent.com/d10or/workspace-guardian/main/demo/recordings/risky.gif

---

## 1. Reddit — r/ClaudeAI (also fits r/ClaudeCode)

**Title:** I built a small local tool that tells two Claude Code sessions who owns which files, and warns before they collide

**Body:**

I run two or three Claude Code sessions on one repo, each in its own worktree. Worktrees keep the files apart while they work, but the collision just moves to merge time: both sessions touched the same route file, two migrations with different names fight over the same table, and the "tests pass" in the summary was from before the last edit.

Anthropic's docs say "give each teammate different files." There was nothing that checks that. So I built it.

**Workspace Guardian** is a Claude Code mod plus a CLI. MIT, local only, no account, no network.

- `/task add AUTH 'src/auth/**' --branch feature/auth` declares that a task owns those paths. The declaration lives in the repo, so every worktree and every later session sees it.
- If a session on another branch tries to edit an owned file, the edit is held and you get an Allow / Deny question before anything lands.
- `guardian check` reports, before you merge: declared overlaps, the same file changed in two worktrees, files a task touched outside its claim, hotspot files (lockfiles, migrations, schemas) touched by several worktrees even under different names, worktrees behind base, in-flight git operations. Every finding ends with a fix.
- `guardian handoff --task AUTH --run 'npm test'` writes a report that says **verified** only if it ran the tests itself, with the exit code and a fingerprint of the tree. Otherwise it says **not verified**. It will not launder a claim.
- The `/sessions` pane shows every live session, worktree, claim and message on your machine.

What it does not do: merge, rebase, push, resolve conflicts, or run anything in the cloud. It flags risk and leaves the decision to you.

GIF of a collision being caught: [link]

Install (Claude Code 2.1.287+): `/plugin install session-agents --marketplace d10or/workspace-guardian`
CLI: clone, `npm install && npm run build && npm link`.

macOS and Linux. Windows not yet. I would value hearing which findings are true risks and which are noise on your repos; the check is deliberately conservative and labelled advisory.

---

## 2. Show HN

**Title:** Show HN: Guardian – preflight collision checks for parallel Claude Code worktrees

**Text:**

I run several AI coding sessions in parallel on one repo. Worktrees isolate the files but only defer the conflict to merge time, and the agents' "done, tests pass" summaries are often untrue at the moment they are made (I measured 35% stale or false on my own sessions before building this; a 716-merge study found a 41.7% textual conflict rate between PRs from different agents).

Guardian is a small MIT CLI plus a Claude Code plugin. You declare which task owns which paths on which branch; that lives in `.guardian/tasks.json` in the repo. From there:

- the plugin holds an edit from another branch into an owned path and asks you;
- `guardian check` reports declared overlaps, same-path changes across worktrees, scope violations, hotspot categories (two migrations with different names count as one), stale base, in-flight git ops, each with a remediation and a suggested merge order;
- `guardian handoff` records test evidence only when it ran the tests itself (exit code + tree fingerprint), otherwise prints "not verified".

Everything is read-only except the task file; git is called with argv only, never a shell string; no network. It never merges or pushes.

What is deliberately not here: conflict resolution, a dashboard of sessions beyond the local pane, anything cloud. The closest neighbours are worktrunk's merge-tree flag and Radar's test gate; neither has the ownership declaration, which is the part I needed.

Repo: https://github.com/d10or/workspace-guardian — 20-second clip of a collision caught in the README.

I would like to know where the heuristics produce noise on real repos.

---

## 3. X thread (tag @claude_code in the first post)

1/ Two Claude Code sessions, one repo, one merge headache. Worktrees keep files apart while agents work; they do not stop both agents from editing the same route file. I built a small local referee for this. MIT, no account, no network. 🧵

2/ Declare ownership once: `/task add AUTH 'src/auth/**' --branch feature/auth`. It lives in the repo, so every worktree and every future session sees it.

3/ A session on another branch edits an owned file? The edit is held and you get Allow / Deny before it lands. [clip: Allow/Deny inside Claude Code]

4/ Before merging: `guardian check`. Declared overlaps, same file changed in two worktrees, files touched outside a claim, two migrations with different names flagged as one hotspot, worktrees behind base. Every finding ends with a fix. [risky.gif]

5/ Handoff that cannot lie: `guardian handoff --task AUTH --run 'npm test'` says "verified" only if it ran the tests itself, with the exit code and a tree fingerprint. Otherwise: "not verified". [handoff.gif]

6/ It never merges, rebases, or pushes. It flags risk; you decide.
Install: `/plugin install session-agents --marketplace d10or/workspace-guardian`
https://github.com/d10or/workspace-guardian
Tell me where it is noisy on your repo.

---

## 4. Anthropic directory submission (claude.ai/directory/manage → Plugin bundle)

**Name:** session-agents (Workspace Guardian)

**Short description (≤ 120 chars):** Task ownership and collision warnings for parallel Claude Code sessions on one repo. Local, no network.

**Long description:**

Workspace Guardian helps developers who run several Claude Code sessions on one repository. Declare which task owns which paths on which branch with `/task add`; the declaration is stored in the repo and shared by every worktree and session. An edit from another branch into an owned path is held and the user is asked. The `/sessions` pane shows every live session, worktree, file claim and peer message on the machine. The companion `guardian` CLI reports overlap and scope risks before merging and writes handoff reports whose test evidence is marked verified only when it ran the tests itself.

Runs entirely locally: no account, no API key, no network, no telemetry. Writes only to `.guardian/tasks.json` in the repository and its own folder under the Claude config directory. Never merges, rebases, pushes, or deletes. MIT. macOS and Linux.

**Category:** developer tools / workflow
**Repo:** https://github.com/d10or/workspace-guardian
**Support:** GitHub issues

Pre-submission check (docs/plugins/pre-submission-checklist): public repo ✔, LICENSE ✔, README ≥ 40 words ✔, no binaries in the plugin folder ✔ (the mod is TypeScript; the CLI is a separate npm build), files ≤ 256 KiB ✔ (register.tsx ~90 KB; GIFs live outside the plugin folder).

---

## 5. awesome-claude-code (after 2026-11-03, 14 days of commits)

Submit via the issue form only. Category: Agent Orchestration. One line:
"Workspace Guardian — task-level path ownership and preflight collision checks for parallel Claude Code sessions; local CLI + mod, MIT."

---

## Replies to expect, and the honest answer

- "Doesn't `claude --worktree` already do this?" — It isolates files; it does not know what each session is supposed to own, and it blocks edits into the main checkout only. Guardian adds the declaration and checks between worktrees.
- "What about Conductor / Claude Squad?" — Session managers. Guardian sits beside them; it does not launch sessions.
- "Can an agent bypass the hold?" — Through the Edit/Write tools, no. Through a shell `cp` or redirect, yes; the same blind spot Claude Code's own guard documents. `guardian check` sees it afterwards via git.
- "Windows?" — Not yet. Say if you need it; that decides whether it gets built.
- "Is it free?" — The core is MIT and stays so. A small paid tier may come later for merge planning and CI policies.

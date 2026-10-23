# G1 Research: Pain Points, Competitors, Positioning, Distribution

**Prepared:** 2026-10-17 | **Status:** desk research complete; developer interviews still pending | **Owner:** founder

This document is the evidence base for the G1 gate in `MASTER_PLAN.md`. Desk research plus the founder's own experience replaces the interview plan (decision 2026-10-20). The ten pain points below are the project's
initiative list: each one maps to a feature, a fixture, and a plain-English warning.

Method note: GitHub issues were read directly via `gh`; Cursor forum, OpenAI forum, Hacker News
and dev.to posts were read directly. Reddit was not reachable from the research environment, so
no Reddit threads are cited. One heavily-promoted vendor voice (a 25-comment thread dominated by
a single product's author) was counted as one source, not many.

---

## 1. The ten pain points (ranked by evidence weight)

Workflow stage: PLAN = task planning, OWN = file ownership, OVERLAP = overlap detection,
MERGE = integration, TEST = test evidence, HANDOFF = context handoff.

| # | Pain point | Stage | Independent sources | Strongest evidence | Already solved? | Guardian response |
|---|---|---|---|---|---|---|
| P1 | **Worktrees only defer the conflict.** Parallel tasks still collide on shared hotspot files (schema, config, routes, lockfiles, migrations) at merge time, and resolving it burns agent context. | OVERLAP / MERGE | 9+ | Study of 716 replayed merges: 41.7% textual conflict rate between PRs from different agents vs 19.8% within one agent (arXiv 2607.04697). "Conflict resolution was eating 30–50% of parallel agent time" (Paola, Feb 2026). | Partially: Clash (early, read-only monitor), Foremerge (pre-1.0, heuristic). Codex issue #36719 and claude-code #89509 are open requests. | `guardian check`: declared-glob overlap + changed-path overlap across worktrees, with a hotspot-file heuristic. |
| P2 | **Silent last-write-wins overwrites** when agents share one checkout; no warning, prior uncommitted work vanishes. | OWN | 9 | claude-code #52051: "the single biggest source of 'wait, why is my repo in this state' confusion". #55586: 151 duplicate teammates made 12,974 edits to one codebase. | Mostly solved for separate sessions by worktrees. Not solved for Claude Code agent-team teammates sharing one cwd, or Cursor parallel subagents. | `guardian inspect` flags multiple active sessions/tasks in one checkout; `check` reports competing changed paths. |
| P3 | **No mechanism to declare or enforce file ownership per task.** Docs say "give each teammate different files" and offer nothing that checks it. | PLAN / OWN | 6 | claude-code #89509: "That is a rule with no mechanism. Nothing stops a teammate writing a file another teammate owns, and nothing reports it after the fact." Codex #36719 proposes an "intent map" with `intends to modify:` lists. | Unmet first-party. Third-party: Foremerge (advisory claims, pre-1.0). | `guardian task add --paths` is exactly this claim; `check` reports violations. Core wedge. |
| P4 | **Unverified "tests pass" / "done" claims.** Claims are stale (edits after last run) or tests were never run. | TEST | 7 | Two independent personal datasets: 35 of 101 "tests pass" claims untrue at the moment made (Eiberger, Sep 2026); 65–69% of ~500 "done" claims had no passing test run behind them (raimondasl, Sep 2026). | DIY only (isitdone, handfest, prove-it hooks). No shared "verified / not verified" standard. | `guardian handoff` records test command, exit code, and working-tree hash at run time, or prints "not verified". |
| P5 | **Session handoff is manual.** No standard artifact saying what was done, where, and what is pending. | HANDOFF | 6 | claude-code #11455 (26 thumbs-up, 38 comments, active Nov 2025 to Jun 2026, at least 5 DIY handoff tools posted in-thread). "Need an official handoff" (May 2026). | Partially: `--resume`/`/export` cover same-machine resume; Amp has "handoff". Cross-session evidence-bearing summary is DIY. | `guardian handoff` Markdown + JSON: branch, commit, changed paths, tests, open risks, next steps. |
| P6 | **Review and merge is the real bottleneck; merge cost grows superlinearly** and must be done sequentially. | MERGE | 6 | "The merge tax is superlinear. Each resolved conflict changes the base, invalidating other branches' assumptions" (Paola). "Parallel building is okay. Parallel merging is not." (Cursor forum, May 2026). | Unmet. Dashboards give diff viewers; nothing proposes a merge order or per-task risk summary. | `check` outputs a suggested merge order (least-overlapping first) and per-task risk level. P1 for v0.1. |
| P7 | **Declared scope vs actual diff mismatch.** Agent writes outside its assigned scope or into the wrong tree; found only at review. | OVERLAP / HANDOFF | 5 | claude-code #76727: of 13,782 Edit/Write calls from sessions in the primary checkout, 44% wrote into the primary's tree. Cursor staff: worktree isolation "relies on instructions in the system prompt, not on tool-level restrictions". | Partially: Claude Code now blocks Edit/Write into the main checkout for `--worktree` sessions but not shell writes (`cp`, redirects). Nobody compares declared scope to actual diff. | `check` and `handoff` list "paths touched outside claim". |
| P8 | **Logical conflicts that merge clean**: duplicate effort, contradictory changes, shared-ID or schema assumptions. | OVERLAP / MERGE | 6 | "Two sessions independently allocating the same 'next free' ID in a shared ledger file: different filenames, merges clean, silently corrupt" (#76727, "happened to me twice in one day"). Study authors call textual conflicts "a lower bound". | Unmet. Foremerge aims at it, admits heuristic. | Cheap heuristic: warn when two tasks both touch `migrations/`, lockfiles, `schema.*`, generated files. Advisory only. |
| P9 | **Losing track of which session / worktree / branch did what**; directory names stop matching tasks. | HANDOFF | 6 | claude-code #79366 (18 thumbs-up): "has happened repeatedly across sessions". HN: "annoying to remember in which directory a branch clone lives". | Partially: dashboards list sessions; none tie task → branch → commit → changed paths. | `inspect` shows worktree ↔ branch ↔ task mapping from `.guardian/`. |
| P10 | **Merge or cleanup silently destroys work** (git lock contention, worktree auto-cleanup of uncommitted changes, merge tools dropping local changes). | MERGE | 6 | claude-code #55724: 13 parallel agents, 8 failed on lock contention, uncommitted work "permanently lost". vibe-kanban #543 "consistently" loses local changes on merge. | Partially: Claude Code cleanup now prompts when a worktree has work; vibe-kanban #1897 still open. | `inspect` warns on uncommitted work in any worktree and on a `index.lock` present. Guardian itself never cleans up or merges. |

Pain points seen but **deliberately out of scope**: per-worktree env setup (.env, ports, node_modules: already solved by `.worktreeinclude`, Conductor scripts, autowt), concurrent corruption of `.claude.json`/CLAUDE.md (vendor bugs), token cost of parallelism.

### What this means for the product

- **Already solved, do not rebuild:** on-disk isolation (worktrees), session dashboards, env-file copying, same-machine session resume.
- **Partially solved, early competitors:** pre-merge overlap detection (Clash, Foremerge), test-evidence gating (DIY hooks).
- **Unmet, strongest fit:** (1) declared task → path ownership with violation reports, (2) declared scope vs actual diff per task, (3) cross-task overlap report with a suggested merge order, (4) evidence-based handoff record, (5) semantic-conflict hints on hotspot files.

### Frequency and willingness-to-pay evidence

- Frequency quotes: "twice in one day", "repeatedly across sessions", "I get this all the time", "near-100% reproducible", "at 10+ agents it's near-certain some will fail". A heavy-user profile exists: one solo developer runs ~20 worktrees and 15–20 concurrent sessions.
- Willingness to pay is **thin**. One explicit quote: "People on 100–200/month claude code subscription wouldn't mind paying 10–30 bucks for this" (HN, Jul 2025). Price anchors are low: Conductor, Crystal, ccmanager, native worktrees are free; Superset Pro is $20/seat/month. Heavy users repeatedly built their own handoff tooling and gave it away. Expect "free CLI, paid extras" and treat H4 (3 paying customers) as a genuine test, not an expectation.

### Fixtures implied by the pain points (G2 seed list)

Each pain point becomes at least one fixture with an expected plain-English warning:

1. Two tasks claim overlapping globs (`src/auth/**` vs `src/auth/session.ts`).
2. Two worktrees both modified `package-lock.json` (hotspot heuristic).
3. Task claims `src/api/**` but diff touches `src/db/schema.ts` (scope violation).
4. Handoff with no test output supplied → "not verified".
5. Handoff with test output older than last edit → "stale: edits after last run".
6. Two tasks both touch `migrations/` with different filenames (logical conflict hint).
7. Uncommitted changes in a worktree whose task is marked done.
8. `index.lock` present in a worktree.
9. Worktree directory name does not match its task's branch.
10. Branch diverged from base by more than N commits (stale base).

---

## 2. Competitor matrix (20 tools checked, 2026-10-17)

Columns: **A** explicit task → path ownership, **B** preflight overlap detection before work starts,
**C** merge-readiness / conflict-risk report, **D** structured handoff with test evidence.
V = verified in the tool's own docs or README; U = not found.

| Tool | What it is | Price / license | Maintained | A | B | C | D | Note |
|---|---|---|---|---|---|---|---|---|
| Claude Code native | `--worktree`, agent teams, `/batch`, hooks (`PreToolUse`, `TaskCompleted`, `WorktreeCreate`) | subscription | daily releases (2.1.302 on 2026-10-16) | No (V) | No (V) | Partial | Partial | Docs literally prescribe the manual process: "Break the work so each teammate owns a different set of files." Isolation guard blocks edits into the main checkout only, not between worktrees. |
| Conductor | macOS app, parallel agents in worktrees, review + merge | Free; Pro $50/mo; Teams $60/user | 0.91.0 on 2026-10-15; $22M raised | No (V) | U | Partial (Checks tab: CI, PR status) | U | Merges itself. |
| Claude Squad | tmux TUI, one worktree per session | Free, AGPL-3.0 | v1.0.20 Aug 2026, 8.6k stars | U | U | U | U | Isolation only. |
| Vibe Kanban | Kanban + workspaces | Apache-2.0; company shut down 2026-04-10 | community commits | U | U | Partial (behind-target, conflict status) | U | Failed to convert free users at $30/user. |
| Crystal → Nimbalyst | Electron session manager | MIT; Teams $20/user | Nimbalyst 0.81.7 on 2026-10-16 | U | U | U | U | |
| ccmanager | Ink TUI session manager | MIT | v4.4.8 on 2026-10-17 | U | U | U | U | Copies session data between worktrees. |
| agent-of-empires | Rust tmux manager, Mozilla.ai backed | MIT | v1.20.0 on 2026-10-15, 3.4k stars | U | U | U | U | |
| worktrunk (`wt`) | worktree CLI for parallel agents | MIT/Apache | v0.80.0 Sep 2026, 9.3k stars | No (V) | No (V) | **Partial-strong** (`git merge-tree` conflict flag per worktree) | pre-merge hooks run tests | Merges and rebases itself. Guardian's report could run as its pre-merge hook. |
| Superset (YC) | "orchestrate 100+ agents" IDE | Elastic 2.0; Pro $20/user | 1.38.0 on 2026-10-14 | No (V) | No (V): "worktrees do not prevent merge conflicts" | needs-rebase marker | U | |
| cmux / Xum / Emdash | agent terminals and desktop apps | GPL / AGPL / Apache | Oct 2026 | No | No | Xum: divergence UI | No | |
| **Radar** (Jake-Network/radar) | local, non-mutating gate: combines branches privately, checks conflicts and declared contracts, runs related tests | MIT | created 2026-10-09, 2 stars | Partial (API contracts, no path ownership) | Partial (post-hoc drift) | **Yes**: PASS / FAIL / NOT VERIFIED | **Yes**: `Radar-Verified:` trailer, Stop hook, MCP | Closest neighbour on C and D. Eight days old, zero traction. Read in full before G2. |
| Cursor | `/worktree`, `/best-of-n`, cloud agents | tiers $8–$200 | Oct 2026 | No (V) | No (V) | marketing only | artifacts on PR | Isolation is prompt-based per staff. |
| OpenAI Codex | cloud tasks, app worktrees, "handoff" = move chat | $8–$100+ | CLI 0.163.0 | No (V) | No (V) | No | test results in cloud UI | Open issue #36719 asks for an intent map. |
| GitHub Copilot agent / Devin / Sprites / Amp / Jules / Factory / Warp | cloud agents, VMs | various | Oct 2026 | No | No | CI mergeability only | logs, not evidence | None address ownership or overlap. |

### Where the open gap really is

- **A + B (declare ownership, check overlap before starting) is genuinely empty.** No tool does it. Anthropic's docs prescribe it as a manual discipline. Codex issue #36719 and claude-code issue #89509 ask for exactly this and have no vendor response.
- **C and D are narrower than they look.** worktrunk already shows a merge-tree conflict flag, Conductor/Devin/Claude Code show CI mergeability, and Radar ships a PASS / FAIL / NOT VERIFIED gate with test evidence. Treat handoff and merge-readiness as fast-follow features, not the wedge.
- **Structural risks:** Anthropic ships worktree and team features weekly; the one funded open-source orchestrator that charged (Vibe Kanban) shut down because "most were free users".

### Our own head start

This repository already contains **session-agents v0.13.0**, a working Claude Code mod with live
session discovery, per-session file claims with expiry, an edit pause on claimed or recently-edited
files, peer messaging, and a git/worktree pane. It already covers P2 (silent overwrites, by pausing
the first edit) and P9 (which session is where), and half of P3 (claims exist but die with the
session). See `docs/MOD_REVIEW.md`. No competitor has an equivalent mod surface, because mods only
became generally available on 2026-10-01 (Claude Code 2.1.287).

---

## 3. Positioning

**Category:** preflight coordination for parallel AI coding sessions. Not a session manager, not a
worktree manager, not an orchestrator. It sits beside Conductor, Claude Squad, worktrunk and native
worktrees rather than replacing them.

**One-line pitch:** "Before two Claude sessions touch the same files, Guardian tells you. Before you
merge, it tells you what was actually tested."

**Wedge (build first):** task-level ownership claims that outlive a session, checked in real time at
`PreToolUse`, with a plain-English overlap report. This is the empty cell in the matrix.

**Fast-follow (G2 late / G3):** handoff report with test evidence, declared-scope-vs-actual-diff,
suggested merge order. Compare against Radar before building; integrate rather than compete if it
has grown.

**Not building:** merging, rebasing, cleanup, dashboards of sessions (session-agents already has
one), cloud anything.

**Free vs Pro (hypothesis for G5):** free core = claims, check, pause, handoff Markdown. Pro one-time
$29 = merge-order planner, JSON schema export, hotspot heuristics pack, priority support. The two
existing one-time Claude Code products (Context Manager $29, SessionWatcher $6.99–$59) show the
price band is plausible. The plugin catalog has **no payment mechanism**, so Pro must be enforced by
the CLI (license key via Gumroad / Lemon Squeezy / Polar). The free core must stay open-source and
payment-free to qualify for awesome-claude-code.

---

## 4. Distribution: the Claude Code plugin and mod route

### Mechanics (official docs)

- A **plugin** is a directory with `.claude-plugin/plugin.json` bundling skills, agents, hooks, MCP servers, and optionally a **mod** (a hooks module in `hooks/register.tsx` that can intercept tool calls, draw a pane or a band above the prompt, add slash commands). Mods are on by default since Claude Code 2.1.287 (2026-10-01). Docs: https://code.claude.com/docs/en/plugins and https://code.claude.com/docs/en/plugins/mods/overview
- A **marketplace** is any repo with `.claude-plugin/marketplace.json`. "It's a catalog, not a hosted store." This repository now has one at its root. Users install with one line: `/plugin install session-agents --marketplace d10or/workspace-guardian`. Docs: https://code.claude.com/docs/en/plugins/create-marketplace
- **Anthropic directory** (claude.com/marketplace, 341 plugins today): anyone on a paid Claude plan can submit a public GitHub repo at https://claude.ai/directory/manage. Needs LICENSE, README ≥ 40 words, no compiled binaries inside the plugin (call an installed CLI from scripts). Gives install analytics. The official `claude-plugins-official` marketplace is partner-only. Docs: https://claude.com/docs/plugins/submit
- **Hooks** let a plugin block or annotate edits: `PreToolUse` with matcher `Edit|Write` receives the absolute `file_path`; return `permissionDecision: deny|ask|allow` with a reason. `TaskCompleted` can refuse completion until tests ran. These command hooks also work in `claude -p`, cloud, and teammates, where a mod's UI does not draw. Docs: https://code.claude.com/docs/en/hooks
- **Paid plugins:** no mechanism, no mention in the Directory Terms. Private marketplace repos and the `command` source are the only gating primitives.

### Ship shape for Guardian

1. **One repository, three surfaces:** (i) the `guardian` CLI on npm, (ii) a plugin with command hooks (`PreToolUse` ownership check, `TaskCompleted` evidence check) that works everywhere, (iii) the session-agents mod for the interactive pane and band. The plugin calls the CLI through `${CLAUDE_PLUGIN_ROOT}` scripts.
2. CLI post-install prints the two `claude plugin` commands (the officially documented "ship a plugin with your own tool" pattern).
3. The `blast-radius` sample mod in anthropics/claude-code-playground shows the exact UX to copy for an overlap warning: hold the tool call, show what would collide, Proceed / Cancel.

### Marketing channels, ranked

| # | Channel | Why | When |
|---|---|---|---|
| 1 | Own marketplace one-liner in README and CLI post-install | zero gatekeeping, official pattern, auto-update | G2 |
| 2 | Anthropic directory submission + `claude-community` form | any paid plan can submit; install analytics; `@synced` reach | G4 |
| 3 | r/ClaudeAI and r/ClaudeCode launch post with a 20-second GIF of a collision being caught | SuperClaude launched there; Vibe Kanban's own HN thread shows the pain felt | G4 |
| 4 | Show HN: "a preflight collision check for parallel Claude Code worktrees" | precedent "local merge queue for parallel Claude Code agents" got 42 points; orchestrator launches run 96–206 | G4 |
| 5 | X thread tagging @claude_code | Anthropic amplified ccusage; Conductor launched this way | G4 |
| 6 | awesome-claude-code listing (needs 14 days of commits or 100 stars, free core) | 55k-star list, long-tail discovery | G4+14d |
| 7 | Integration recipes: worktrunk pre-merge hook, ccmanager / agent-of-empires worktree hooks, Radar comparison page | ride installed bases (9.3k, 1.3k, 3.4k stars); embedding drove ccusage | G3–G4 |
| 8 | Plugin hubs (claudepluginhub.com, claudemarketplaces.com) and GitHub topics `claude-code-hooks`, `claude-code-plugin` | low effort, compounding SEO | G4 |
| 9 | Product Hunt | worked for desktop apps, weak for CLIs | optional |
| 10 | Japanese / Korean dev communities (Zenn, Classmethod, GeekNews) | early amplifiers of ccusage, ccstatusline | G4+ |
| 11 | Agensi.io and similar skill marketplaces: a **free** SKILL.md wrapper that points Cursor / Codex users at the CLI and the store | reaches non-Claude agent users; the CLI is agent-agnostic. Pro is never sold there (30% fee, their connector in the install path, SKILL.md cannot carry a package). Founder decision 2026-10-23: after launch data exists | after G4 |

Traction pattern from the tools studied: Hacker News is hit-or-miss (about one in three breakout
tools had a 100+ point thread). Reddit r/ClaudeAI, amplification by @claude_code, and being embedded
by other tools mattered more.

---

## 5. G1 decision and what changes in the plan

**Decision: GO to G2, with a re-scoped wedge.** Evidence supports H1 (real, frequent, sourced pain)
from desk research alone. Founder decision 2026-10-20: the interview round is dropped. H1 is accepted on the strength of the sourced
evidence above plus the founder's own incidents, which are what the session-agents mod and the
shared-checkout hook were built to fix. Feedback from real users now comes from the G3 alpha testers.

Changes to `MASTER_PLAN.md`:

1. The ten pain points above become the initiative list (section 15 of the plan).
2. Wedge = task-level ownership + preflight overlap; handoff and merge-readiness move to fast-follow.
3. The session-agents mod is adopted as the interactive surface. G2 starts from it instead of from an empty CLI.
4. Radar is added to the risk register (R8) as the closest neighbour on handoff evidence.
5. Distribution plan = own marketplace → Anthropic directory → Reddit/HN/X launch, in that order.

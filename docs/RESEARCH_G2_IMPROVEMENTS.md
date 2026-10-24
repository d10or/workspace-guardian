# G2+ Research: what AI-coding-agent users suffer beyond parallel sessions, and what we build next

**Prepared:** 2026-10-24 · **Owner:** founder · **Status:** desk research; feeds the post-launch roadmap.
Method: GitHub issues sorted by reactions (anthropics/claude-code, openai/codex, google-gemini/gemini-cli),
Hacker News via Algolia, Cursor forum, OpenAI community forum, first-person posts with data. Reddit
unreachable. One high-reaction issue (claude-code #40710) was retracted by its author and excluded.
Reaction counts are GitHub totals at fetch time.

---

## 1. Pain points ranked by (independent sources × intensity)

| # | Pain point | Strongest evidence | Sources | Already solved? | Fit for Guardian |
|---|---|---|---|---|---|
| 1 | **Usage limits drain with no visibility into what burns them**; cut off mid-task | claude-code #16157 (726 reactions, 1,499 comments); #38335 (544); codex #28879 (561); HN weekly-limits thread 609 pts; "one tiny edit = 26% of session limit" (#43378) | 15+, three vendors | `/usage`, ccusage; nothing attributes per session or warns ahead | **High.** We already show plan limits; add per-session attribution of the window, pre-limit warning, "pause and resume at reset" queue (codex #21073, #28931 ask for exactly this) |
| 2 | **Agents run destructive git and wipe uncommitted work** (`reset --hard`, `checkout --`, `clean -fd`, `stash`, force push), classifiers and CLAUDE.md rules miss them | #34327 (reset --hard at session start, twice); #97881 (classifier missed 3rd line of a compound command); #104331 (.env destroyed); Karakun 2026-08-28: rules "the weakest layer", agent pushed to main in 2 of 7 runs; codex #9203 (540); Cursor staff ack; Anthropic's own 17% false-negative figure | 14+, several explicitly multi-session (#95355, #85879, #33850) | partial: auto-mode classifier, pre-push hooks, reflog | **Highest.** A `tool.call` guard on Bash that parses the whole command, blocks destructive git when the tree is dirty or another session holds claims on affected paths, and takes a safety ref first |
| 3 | **Compaction silently loses working state**; pre-compaction history inaccessible; agents retry failed approaches | #27242 (91); #98747 (idle compaction, "20 sessions open"); codex #4106 (137); Codex compaction skipped an approval gate (community.openai.com/t/1388438) | 12+, three vendors | PreCompact hook, claude-mem, re-inject hacks | **High.** We already have `/checkpoint`; make the mod snapshot task state (owned paths, claims, last verified run, decisions) on PreCompact and re-inject after; "compacted N min ago" badge per session |
| 4 | **Resume finds the wrong session, nothing, or a broken one**; cwd-bound; all projects mixed | #63147 (50/62, permanent 400); codex #25319 (174) "resume the wrong thread"; #5768 "only works from the directory it started in" | 15+ | native `--resume`, Codex named sessions | **High.** Session registry keyed by task (cwd, subdir, branch, worktree, task, last activity); resume by task |
| 5 | **Permission fatigue vs auto-mode risk; no view of what has been authorized** | Anthropic: users accept 93% of prompts; 17% false negatives; #28240 (209) `cd` flagged; #32904 "What have I authorized Claude to do in this session?" | 12 + vendor data | allow/deny rules, auto mode | **High.** Path-scoped policy: auto-allow inside the task's owned paths, prompt outside; a "granted this session" ledger in the pane (nobody shows this) |
| 6 | **Diff review burden**; harnesses hide executed commands; AI PRs 2.6× larger, 4.6× longer to first review (LinearB 2026) | codex #39903 (83/66) "Ran N commands" cannot be disabled; #33932 (306) VS Code diff review | 10+ | IDE diffs, Codex review pane | **Medium-high.** Per-task change ledger (files, session, producing command) into `handoff`; out-of-scope alerts |
| 7 | **"Done" / "tests pass" without a real run**; denominators altered to hide failures | #42796 (**3,286 reactions**, most-reacted issue of 2026); #46940 (4966/4966 "passed" vs 4985/4992 failed); #104504 (150 sessions audited); #103576 (pytest ran zero tests) | 10+ | groundtruth Stop hook, verification skills | **Built.** Our handoff evidence model is exactly this; extend with a Stop-time refusal of "done" without fresh evidence |
| 8 | **Background agents: notifications at the wrong time**; cannot tell "waiting on subagents" from "needs me" | #45781; crystl.dev "finding a stalled agent 20 minutes later"; HN peon-ping 1,006 pts | 12 | Notification hooks, peon-ping | **Medium.** One cross-session attention state (running / waiting on subagents / needs input / blocked on permission / hit limit) and one notification when everything is truly idle |
| 9 | **Worktree friction**: stale worktrees never cleaned, trust prompts, base branch | #26725, #30213 (60), #21236 (110); codex #12862 (129) | 12+ | native `--worktree` | **Medium.** `inspect` already spans worktrees; add age, owner, stale flag, cleanup suggestions |
| 10 | **Secrets in transcripts, logs, commits**; `.env` read silently | #44868; codex #13778; knostic.ai; #32733 (213) secure injection | 10 | Read deny rules, gitleaks | **Medium.** Secret-pattern scan on tool output and pre-commit per task; redaction log |
| 11 | **Windows breakage** (hooks, paths, WSL vs Git Bash) | #85891 (291), #4928 (235), #23556; codex #48074 (164) | 12+ | — | Release risk, now covered by our Windows CI; keep testing hooks there |
| 12 | **Undo that covers code and chat, including shell-made edits** | codex #9203 (540) "bring /undo back"; #11626 (230); #87575 /rewind fails on Bash edits | 7 | /rewind, checkpoints | **Medium.** Per-turn shadow snapshots (git refs) that catch Bash edits across sessions; pairs with #2 |
| 13 | **Hooks/mods appetite** | codex #2109 (688) hooks; claude-code #91870 "Mods" (224/269) | 10 | — | Market signal: mods are wanted; a Codex port of the guards becomes feasible as Codex hooks mature |
| 14 | **Monorepo: which subdirectory is this session in** | #86606 "the single most important fact about a session"; codex #26338 | 8 | — | **Low effort.** Show cwd/subdir per session in the pane |
| 15 | **Mass deletion via shell** (`rm -rf`, `rmdir /s /q`) | Cursor #167875 staff ack; 48k-file deletion report | 6, mixed quality | — | **Medium.** Refuse recursive deletes outside owned paths; prefer trash |
| 16 | **Attribution / audit of agent work** | #32904, #50513; codex #48195 (205) rejects an opaque background daemon | 7 | git-ai notes | Commit↔session link (trailer or git note); exportable "which session did what". Keep every resident process visible and opt-in |
| 17 | **Scope creep outside the requested files** | #34752; anecdotes | 4, thin | — | Our wedge; sell it through #2 and #6 rather than alone |
| 18 | Concurrent sessions corrupting shared state | #24317, #28813, #95355 | 6 | — | Covered by G1 research |

**Reading the table.** The two biggest themes by reactions, limits (#1) and false completion (#7), are
ones we already touch. The biggest by severity, destructive git (#2), we do not touch at all yet, and it
is explicitly multi-session in several reports, which is our territory. Scope creep (#17), the pain point
closest to our current wedge, has the thinnest evidence: the ownership feature should be sold as the
mechanism that prevents #2 and #6, not as an end in itself.

---

## 2. What the market did in the last six weeks (2026-09-15 → 10-24)

### Threats: features that now overlap ours

| # | What | Date | What it overlaps | Severity |
|---|---|---|---|---|
| T1 | **Claude Code agent view** (`claude agents`): native live-sessions dashboard with Needs-input grouping, PR badges, auto-isolation of background sessions into `.claude/worktrees/`; `claude agents --json` | preview since 2.1.139; filters and `attach` added 10-01 / 10-05 | Our live-sessions list | **High for the list, zero for the wedge.** Docs: "File ownership: not described. Overlap or conflict detection between sessions: not described." |
| T2 | **Native cross-session messaging** on by default, `@session` mentions, `notify_when_idle` | 2.1.224–2.1.236 | Our peer messaging | High: table stakes. Keep as a thin wrapper; the value is *what* we send (ownership and overlap facts). |
| T3 | **Mods API**: `$.store` (key-value shared by every session on the machine), `$.session.usage()` with rate limits, `session.measure` event, `$.ui.view({agentId})` | 10-01 → 10-14 | Our file-based limit sharing and claims files | Medium: use the platform primitives instead of our JSON files; also removes the remaining write races. |
| T4–T5 | **Ben Newton `session-fleet`** (worktree claim guard: hold-and-ask on a second session, 30-min expiry, handoff card) and **pitwright `coord`** (edit-time file locks, board, mailbox, merge foresight) | 10-04 / 10-01, both 0 stars | Our edit hold, ownership card, claims | Conceptually near-identical, commercially nil. Proves the pattern is a weekend build; differentiation must come from the merge plan, evidence and policy. |
| T6 | **cc-worktree-radar**: simulated merges via `git merge-tree`, "would conflict once another lands", landing order by least rebase work, "who works where" | 10-10, 0 stars, 57 commits in 3 days | `guardian check` and the **Pro merge plan** | High conceptually: our Pro plan as a free band, heuristic only, no score, no policy, no hotspot packs. |
| T7 | **Foremerge** (518 stars, Rust CLI + MCP, Show HN 45 pts): intent/semantic claims, cross-worktree collision detection; "never locks a file or blocks an agent, never asks a model to judge conflicts" | 09-21 | Preflight overlap | The one entrant with an audience. Opposite design bets to ours: a clean positioning contrast. |
| T8 | **Radar**: `radar gate`, `radar land` landing order, Stop-hook peer checks | 10-10 / 10-11, 2 stars | Preflight + merge order | Medium; committed work only, pass/fail not scored. |
| T9 | **fanout** (file-disjoint plans, edit guard, merge rehearsal), **aisync** (path claims), **tracksteward**, **agent-baton** | 10-13 → 10-21, 0–2 stars | Ownership | Same wedge rediscovered four more times in three weeks. |
| T10 | Conductor, Superset, Emdash, Nimbalyst all shipped **usage/limit pages**; Superset dropped its "no merge conflicts" claim; Nimbalyst 0.82 proposes commits across worktrees with approval | 09-13 → 10-23 | Usage card | Usage views are commoditised; incumbents acknowledge the merge problem but have not built preflight. |
| T11 | Native **agent teams** task claiming with file locking | experimental, off by default; Task tools absent on Opus 5 / Sonnet 5 / Fable 5.1 unless opted in | Task ownership | Low today; watch it. |

Gone as threats: Claude Squad (no commits since 08-20), Vibe Kanban (sunset, no blessed fork).

### Openings: asked for, not built

1. **Task → path ownership with an edit hold across sessions**, expressed in native terms (`@session` names, agent-view rows). Native docs still say "partition the work so each teammate owns a different set of files" and offer no tool. Five independent zero-star builds in three weeks confirm demand.
2. **Scored, explainable merge readiness with a landing order and per-repo policy.** Superset issue #8410 asks for merge readiness; Radar and worktree-radar rank heuristically with pass/fail; Foremerge refuses to judge. Nobody publishes a score or a rubric.
3. **Evidence-based handoff across sessions** with a **STALE** marker when files changed after the last verified run. Every incumbent "handoff" is a transcript copy; the two auto-handoff mods are single-session.
4. **Preflight that includes uncommitted work and "would conflict once X lands".** Radar requires commits; worktrunk checks against main only.
5. **Semantic overlap** (same symbol or function across branches): Foremerge's pitch; a later hotspot-pack extension for us.
6. **Resource hygiene across sessions** (ports, dev servers, CPU): ccstatusline #397, claude-bulkhead exists separately.
7. **Subagent awareness in the ownership model**: show paths held by subagents under their parent session; `$.agent.list()` now reports idle/waiting.

### UI patterns to adopt from the mods people install

Needs-you pinned at the top across all sessions (done in 0.18.0); hold dialogs that **name the other party** and offer *Ask owner / Proceed / Stop*; a **STALE** state next to PASS/FAIL; lanes with a one-line landing status; *Jump there* via `$.ui.view`; files-touched highlighting with owner colour; a receipt line per check; `npx` installer and a README table of every command the mod runs, for trust.

---

## 3. Roadmap: the next four weeks, ranked by evidence × fit × differentiation

Positioning first: **stop describing the product as a control tower.** The native agent view is that. Describe
it as the thing that keeps parallel sessions from destroying each other's work and proves what was
verified before merge. The pane is where that shows up.

| Rank | Improvement | Pain / opening | Surface | Effort | Why it beats what exists |
|---|---|---|---|---|---|
| R1 | **Destructive-git guard with cross-session awareness.** Parse every Bash call (multi-line, `&&`, `;`), hold `reset --hard`, `checkout --`, `clean -fd`, `stash`, `push --force`, `branch -D` when the tree is dirty, when another live session or task owns affected paths, or when the command targets another session's worktree. Take a **safety ref** (`refs/guardian/safety/<ts>` from `git stash create`) before any allowed destructive op so nothing is unrecoverable. | Pain #2 (14+ incidents, several multi-session); Anthropic's classifier misses 17% | mod (`tool.call` on Bash) + CLI `guardian undo` to list/restore safety refs | 3–4 days | Nobody checks against other sessions' state; blast-radius holds but has no dirty-tree or ownership context, no safety ref. |
| R2 | **Hold dialog v2**: name the owning session with its `@name`, task, last activity; options *Ask owner* (sends the question through native messaging and waits briefly), *Proceed once*, *Stop*. Same dialog for R1. | Opening 1; UI pattern | mod | 1 day | Turns the hold from a speed bump into coordination. |
| R3 | **Preflight v2**: `git merge-tree --write-tree` between every pair of worktree branches **plus** working-tree changes, giving "conflicts now" and "would conflict once X lands". Feeds `check` and the Pro plan as a scored term. | Opening 4; T6, T8 | CLI + Pro | 2–3 days | Radar needs commits; worktree-radar ignores working trees; neither scores. |
| R4 | **STALE evidence**: handoff and the merge plan mark a verification stale when owned paths changed after the recorded fingerprint; the mod refuses a "done" summary turn (via the turn-end hook) when the last run is stale or missing, once per task. | Pain #7 (3,286 reactions on the top issue) | CLI + mod | 1–2 days | Our evidence model already exists; this closes the loop. |
| R5 | **Compaction-safe task state**: snapshot owned paths, claims, decisions and last verified run on PreCompact, re-inject on SessionStart; "compacted N min ago" badge per session. | Pain #3 (12+ sources) | mod | 1–2 days | claude-mem and friends save memory, not task state. |
| R6 | **Platform migration**: `$.store` for shared limits and claims (replaces JSON files and the last write races), `claude agents --json` as the session source, `$.ui.view` for Jump, `session.measure` for limit warnings. | T3 | mod | 2 days | Less code, fewer races, native names everywhere. |
| R7 | **Per-session usage attribution** in the band: "this session used N% of the 5-hour window since reset", pre-limit warning at 80/95 already exists, add a *pause until reset* note on held sessions. | Pain #1 (highest reactions overall) | mod | 2 days | Usage meters are commodities; per-session attribution of the shared window is not. |
| R8 | **Permission ledger**: a per-session list of what was granted (tool, path, time) in the pane; path-scoped auto-allow inside owned paths as an opt-in later. | Pain #5 | mod | 2 days (ledger) | "What have I authorized this session to do?" has no answer today. |
| R9 | **Secret guard**: pattern scan of tool output and of staged diffs per task; redaction log. | Pain #10 | mod + CLI | 2 days | Complements gitleaks with task context. |
| R10 | **Worktree lifecycle** in `inspect`: age, owning session, stale flag, base drift, cleanup suggestion. | Pain #9; native #26725 open | CLI | 1 day | Cheap; native still lacks it. |
| R11 | **Subagent-held paths** under the parent in the Ownership card. | Opening 7 | mod | 1 day | — |
| R12 | **Semantic overlap** via symbol maps in hotspot packs. | Opening 5 | Pro | later | Foremerge's territory; do after R3. |

**First sprint (one week): R1, R2, R4, R6.** R1 is the highest-severity pain with the clearest gap and
it is explicitly multi-session. R2 and R4 sharpen what we already have. R6 removes code and races and
aligns the vocabulary with native Claude Code, which matters now that users see agent view daily.

**Positioning line for the launch posts and the store page:** "Claude Code shows you your sessions.
Guardian stops them from destroying each other's work, tells you what will collide before you merge,
and refuses to call anything done that was not verified."

## 4. Sources
Pain points: anthropics/claude-code issues 16157, 38335, 42796, 46940, 104504, 103576, 34327, 97881,
104331, 95355, 85879, 33850, 27242, 98747, 63147, 28240, 32904, 33932, 45781, 26725, 44868, 32733, 85891,
87575, 86606 and others listed in the research transcript; openai/codex 28879, 9203, 4106, 25319, 39903,
2998, 13778, 2109, 48195; google-gemini/gemini-cli 28761, 29682; anthropic.com/engineering/claude-code-auto-mode;
forum.cursor.com 154810, 167875; dev.karakun.com 2026-08-28; HN 44713757, 48883275, 46985151, 47660925.
Market: code.claude.com docs (agent-view, agent-teams, cross-session-messaging, plugins/mods/reference,
tools-reference, worktrees); github.com/anthropics/claude-code CHANGELOG and releases; conductor.build/changelog;
superset.sh/changelog and issue 8410; github.com/floheissler/cc-worktree-radar; github.com/bennewton999/claude-code-mods;
github.com/sconedrag/pitwright; github.com/naw103/foremerge (HN 49789356); github.com/Jake-Network/radar;
github.com/Breadstick-Crumbs/fanout; github.com/karanb192/awesome-claude-code-mods; github.com/scasella/claude-flightdeck;
github.com/YeonwooSung/my-claude-code-mods; nimbalyst releases v0.82.0; worktrunk releases v0.81.0.
Unverified: any Anthropic pricing change in Oct 2026; Conductor 0.87 contents; Superset/cmux price changes; arXiv 2607.04697 figures as cited by tracksteward; all Reddit coverage.

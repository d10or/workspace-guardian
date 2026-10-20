# Multi-Agent Workspace Guardian
## Business, Product & Execution Master Plan
**Version:** 1.0 | **Prepared:** 2026-10-17 | **Pilot:** 2026-10-19 to 2026-11-29 | **Status:** G1 desk research done 2026-10-17 (see `RESEARCH_G1.md`); H1 accepted via desk research + founder's own incidents; G2 in progress: mod v0.14.1 with task ownership, CLI v0.1 with inspect / task / check / handoff (2026-10-20)

> **Mission:** Help individual AI-assisted developers coordinate parallel coding tasks, detect cross-task integration risks before merging, and hand off verified work with minimal setup.
>
> **North-star evidence:** Developers repeatedly use the tool on real projects and some pay for its added value. Shipping features alone is not business validation.

## 1. Executive decisions and boundaries

| Decision | Baseline |
|---|---|
| Working product name | Multi-Agent Workspace Guardian (working name; check trademark before commercial release) |
| Primary persona | Individual developers using 2+ Claude Code sessions/worktrees on one repository |
| Secondary persona | Developers mixing Claude Code, Codex, Cursor, etc. (research only during pilot) |
| Initial platform | macOS and Linux; local Git repositories; Claude Code first |
| Packaging | A small CLI with a companion Claude Code skill; local files, no mandatory service |
| Business model hypothesis | Useful free core; optional $19–$29 Pro one-time purchase, to validate—not assumed demand |
| Pilot budget assumption | Founder-led; no paid advertising; use existing development hardware and accounts |
| Owner | Founder/product owner: user. Engineering executor: Claude Code, under human review. Strategy/docs/analysis assistant: ChatGPT. |
| Decision authority | Founder approves scope, security policy, release, pricing, and any spend |
| Hard limits | No production/customer/internal company secrets in tests; read-only analysis by default; no unattended merges, destructive Git commands, or source edits |

**Core differentiation hypothesis:** Native Claude Code already has worktree-based isolation, while Conductor and Claude Squad manage concurrent agent sessions/workspaces. Compete on **preflight task overlap checks + explicit file/task ownership + evidence-based handoff + merge-readiness inspection**, not on starting more terminals. Confirm whether this is genuinely unmet before implementing a full product.

## 2. Customer problem and testable hypotheses

**Job to be done:** "When I run separate AI coding sessions in parallel, help me plan who owns which change, know where their changes may collide, and integrate each task safely without manually reconstructing what happened."

**Hypotheses (not facts):**
1. **H1 — Problem frequency:** At least 5 of 8–10 qualified interviewees describe a specific coordination or integration incident within the last 30 days.
2. **H2 — Value:** At least 4 of 5 alpha testers successfully finish the guided two-task workflow and say they would use the tool again.
3. **H3 — Retention:** At least 8 users use the product in two different sessions during the pilot (opt-in aggregated counts or voluntarily shared evidence).
4. **H4 — Commercial signal:** At least 3 real customers buy the paid edition (stretch: 5) by 2026-11-29, without relying on friends/family goodwill purchases.
5. **H5 — Safe/reliable:** Zero critical security/privacy incidents, zero unattended destructive Git operations, and deterministic output on fixture tests.

**Who is not in scope:** Enterprises requiring SSO, hosted dashboards, CI orchestration, source-code ingestion, central policy management, or support SLAs.

## 3. Competitive baseline (re-check at Week 1)

| Existing option | Existing strengths | Our gap to investigate | Source |
|---|---|---|---|
| Claude Code native | `claude --worktree`, session isolation and agent-team options | Shared cross-session task intent and reliable explicit handoff for independently operated sessions | https://support.claude.com/en/articles/14554000-claude-code-power-user-tips |
| Conductor | Parallel workspaces, branches, diff reviews, checks, PR flow | Lightweight CLI-first preflight coordination usable without adopting a new workspace UI | https://www.conductor.build/docs/guides/parallel-agents/run-multiple-claude-code-sessions |
| Claude Squad | Session management using tmux and Git worktrees | Structured task claims and integration-risk reports, separate from session UI | https://github.com/smtg-ai/claude-squad |
| Vibe Kanban (sunsetting) | Agent task board, workspaces, review | Do not assume an ongoing managed competitor; open-source ideas still cover much of the space | https://vibekanban.com/ |

**Week-1 research requirement:** Expand to >=10 credible direct/adjacent tools. For each, record price/license, current support, preflight task claims, overlap checks, automated handoffs, data privacy, and proof/demo. Search GitHub issues, communities and app reviews for *unresolved* pain. A feature missing from marketing copy is not proof it is absent.

## 4. MVP product requirements — v0.1

### Core workflow
1. User starts an ordinary local Git repository and invokes `guardian inspect` to show branch, working tree status, and other worktrees safely.
2. User registers work to be coordinated using `guardian task add --id TASK-01 --paths 'src/auth/**' --branch feature/auth` (write command only after user confirmation); owner is a label, not a security claim.
3. `guardian check` reports declared path overlaps, local tracked/untracked changed-path overlaps, branch divergence, and stale task definitions. It highlights *risk*, not guaranteed conflicts.
4. `guardian handoff --task TASK-01` builds a Markdown/JSON report with branch, commit, changed paths, tests (user-provided results or clearly marked 'not run'), open risks, and next integration steps.
5. User manually reviews the result; no automatic checkout, rebase, merge, push, reset, or deletion.

### P0 acceptance criteria
- Works without an AI model/API key and without external network access on supported macOS/Linux/Git setups.
- Does not change tracked source files in `inspect` or `check`; any state creation is explicit, scoped under `.guardian/`, previewed, and documented.
- `guardian check` catches every fixture with exact overlapping declared globs and flagged competing changed paths; explicitly acknowledges unknown future edits.
- `handoff` never claims tests passed unless verifiable output was supplied; emits "not verified" otherwise.
- No shell-string execution constructed from untrusted input; safe path handling; no arbitrary repo command execution; avoid logging secrets.
- Structured JSON output schema is versioned; human CLI output has precise remediation.
- Quality: at least 20 automated fixtures, macOS/Linux smoke tests, installation/uninstallation instructions, and 0 P0/P1 known bugs at public beta.

### Proposed stack
**TypeScript/Node CLI (LTS supported version), Git subprocess for read-only inspection, JSON manifests and Markdown reports; minimal dependencies; optional `SKILL.md` wrapper.** Validate runtime compatibility and performance during Week 2. Git is the only required repository integration. Future hooks/plugins are explicitly P1.

### Explicitly out of MVP scope
Automatic merges/conflict resolution, background daemons, cloud accounts, live code syncing, telemetry enabled by default, multi-user collaboration, agent chat orchestration, IDE GUI, arbitrary shell execution, code uploading, subscriptions, and enterprise access management.

## 5. Six-week gated execution plan

| Gate | Dates | Concrete deliverables | Pass criteria | Owner / evidence |
|---|---|---|---|---|
| G1 Research + charter | Oct 19–25 | 10-competitor matrix; 8–10 problem interviews; documented PRD v1 | >=5 users report specific recent incidents; clear unmet wedge; scoped P0 list | Founder; interview notes and competitor URLs |
| G2 Working prototype | Oct 26–Nov 1 | CLI skeleton, repo inspection, task claims, risk report, handoff format, 20 fixtures | Key demo runs locally; deterministic fixtures; no unsolicited writes | Engineering; demo recording and test log |
| G3 Private alpha | Nov 2–8 | Installer instructions, guided two-task scenario, 5 testers, safety review | >=4/5 complete main workflow; 0 critical safety events; top 3 usability issues logged | Founder and engineering; tester log |
| G4 Public free beta | Nov 9–15 | Public repo, docs, releases, two demo videos, listing/submissions and landing page | 0 known P0/P1 issues; install works cleanly; measured unique installs opt-in/no invasive tracking | Founder; release checklist |
| G5 Monetization test | Nov 16–22 | Paid-value proposition, checkout page, clear free/paid boundaries, 2 price messages | Real buyer conversations; payment flow/fulfillment tested; early paid conversions monitored | Founder; anonymized sales receipts |
| G6 Continue / pivot / stop | Nov 23–29 | Full funnel review, product feedback, cohort evidence, decision memo | >=50 verified installs, >=15 activations, >=8 repeat users, >=3 paying; safe operation | Founder; tracker + decision log |

**Important:** Gates are sequential. Missing a safety or core-value gate blocks the next launch stage. Commercial numbers are *stretching hypotheses*, not forecasts; a failed target triggers investigation, not fabricated progress.

## 6. Definition of done for each milestone

**G1:** Link to competitors + screenshots/feature verification; interview notes (anonymized); three exact buyer quotes about past behavior; problem statement; ranked feature list; written GO/NO-GO. **Do not implement broad UI.**

**G2:** Clean installation; runs offline on a fixture repo; scripted conflict-risk scenario; test command documented; 20 passing cases (including spaces/symlinks/untracked files/renamed paths); design/privacy review.

**G3:** Five independent testers (not only teammates); observed completion of inspect→claim→check→handoff; record minutes, confusion, usefulness rating, requests, defects; iterate once.

**G4:** Tagged release; changelog; license selected; privacy statement; demo; install, uninstall and error troubleshooting docs; repository with issue template; verified no hidden dependence on private infrastructure.

**G5:** Clear buyer gets X; free core continues to work; payments/licensing/taxes reviewed for intended jurisdiction; customer support contact; checkout/purchase test; optional refund policy; no unsupported claims of guaranteed savings.

**G6:** Freeze metric snapshot; honest evidence and costs; decide **Scale / Iterate 2–4 more weeks / Pivot wedge / Stop** with rationale and next milestone.

## 7. Success scorecard and formulas

| Metric | Definition | Threshold at G6 | Source |
|---|---|---|---|
| Qualified interviews | 2+ concurrent coding-agent sessions used in last month; completed question set | >=8 | Interview Log |
| Verified pain | Interviewees who describe an actual incident within last 30 days | >=5 | Interview Log |
| Alpha workflow completion | Testers finishing inspect→claim→check→handoff | >=4 of 5 | Interview Log |
| Verified installations | Unique voluntary install confirmations; count each user once | >=50 | Weekly Metrics |
| Activated users | Installers who successfully generate at least one risk report | >=15 | Weekly Metrics |
| Repeat users | Activated users who use product on a separate day/session | >=8 | Weekly Metrics |
| Paying customers | Distinct customers completing real payment (refunds excluded) | >=3 (stretch 5) | Weekly Metrics |
| Safety incidents | Confirmed critical leakage/destructive operations | 0 | Risks/Issues |

**Rates:** Activation = activated / installed; repeat activation = repeat / activated; paid conversion = paid / activated; gross revenue = paid orders' collected amount before fees/tax/refunds; net receipts = collected minus refunds and platform/payment fees (not profit). **Do not conflate page views, stars, downloads, installs, and activated users.**

**Measurement:** Do not introduce silent analytics to a code-access tool. Start with self-reported pilot feedback, opt-in anonymous events without file paths or source content, and payment processor summaries. The tracker stores aggregated numbers, not customer PII.

## 8. Interviews, distribution and price validation

### Interview script (15–20 min; record paraphrased answers)
- Tell me about the last time you ran two or more coding agents on the same repo. What were you trying to finish?
- Walk me through an actual merge/conflict/handoff failure. When did it happen? What did it cost you?
- What workaround did you try (worktrees, Conductor, Claude Squad, manual notes)? What remained hard?
- Show how you currently divide task/file ownership and hand off the result.
- Which is most painful: task planning, changed-file visibility, integration, test evidence, or context handoff?
- Would you use this on your next real project? What would stop you?
- After showing prototype: Would you pay $19 for a maintained Pro version providing [clearly defined extra value], or keep using the free version? Why?

**Avoid leading questions** like “Wouldn’t automated conflict detection be useful?”; favor observed behavior.

### Acquisition test
- Week 1: identify channels where the persona already discusses parallel coding: GitHub issues, relevant subreddits, developer Discords, and technical communities. Follow channel rules; no spam.
- Week 3: invite 5 qualified alpha users personally through permitted outreach.
- Week 4: publish genuine demo scenarios (clean repo, risky overlap, safe handoff) plus an educational post about native worktrees and their limits.
- Week 5: simple paid edition: free vs Pro table, short checkout, no forced subscription.
- Track distribution by source using voluntary/referral link and self-reported source; compare activation, not only clicks.

## 9. Weekly operating cadence

**Monday — 20 minutes**
1. Confirm last week's gate outcome using attached evidence.
2. Choose top 3 deliverables and assign one accountable owner each.
3. Review blocked/at-risk backlog items and risks.
4. Declare what will NOT be built this week.

**Friday — 30 minutes**
1. Demonstrate working software or research evidence.
2. Update actuals in tracker; do not enter future goals as actuals.
3. Record decisions: continue, defer, drop, investigate, or pivot.
4. Replan only after recording why timeline/target changed.

**Roles:** Founder owns product/buyer interviews/decisions/payments; Claude Code can implement well-scoped tickets and tests under review; ChatGPT can create/critique specs, test plans, pricing experiments, and weekly retrospectives when prompted. Neither AI tool is an independent ongoing owner without an explicitly configured automation and access.

## 10. Backlog policy and acceptance template

All tasks require: ID, priority P0/P1/P2, named owner, due date, status, linked gate, description, done condition, evidence URL/path, and block reason.

**Ticket template**
```
ID:
User problem / expected outcome:
In scope / out of scope:
Inputs, outputs, error cases:
Acceptance criteria (observable):
Test fixtures:
Security / privacy effects:
Dependencies:
Evidence link:
Owner / due date / status:
```

**Workflow states:** Not Started → In Progress → In Review → Done; any state may become Blocked. “Done” requires an artifact + acceptance evidence, not only an AI-generated claim.

## 11. Risk register (starting risks)

| ID | Risk | Likelihood / impact | Mitigation | Trigger |
|---|---|---|---|---|
| R1 | Native/competing tools already solve buyer problem | High / High | Validate actual missing gap in interviews; revise positioning in G1 | <5 users report unresolved pain |
| R2 | False positives undermine trust | Medium / High | Conservative, explainable checks with clear confidence | >20% false warnings on labeled alpha fixtures |
| R3 | Missed overlap creates false sense of safety | Medium / High | Label results advisory; test edge cases; never assert merge safety | Missed known overlap fixture |
| R4 | Local CLI leaks secrets or damages repo | Low / Critical | Offline/read-only default, explicit writes, secrets test, security review | Any unapproved write/exfiltration |
| R5 | Free alternative compresses willingness to pay | High / Medium | Sell a clear premium benefit, support, reliability; test actual payments | 0 buyers after qualified exposure |
| R6 | Overbuilding before customer feedback | Medium / High | Two-week technical cap, user-interview gate, P0-only scope | Large UI/backend work before G1 |
| R7 | Unclear license/IP rights | Medium / High | Review licenses, avoid employer code/data, document provenance | Any ambiguous reused material |

## 12. Decision rules and next-stage roadmap

**GO (expand free launch):** G1 positive and safe prototype works. **GO (paid pilot):** repeat use and explicit paid-value request exist; no P0/P1 safety issue.

**Scale:** thresholds met; write 90-day plan for paid edition and Codex support. **Iterate:** usage/feedback promising but purchase target missed; isolate which funnel step failed and run one targeted experiment. **Pivot:** users value handoff reports but not conflict warnings (or vice versa); narrow product accordingly. **Stop:** no validated repeated pain or no safe/reliable solution after scoped attempts.

**Future phases, not commitments:** individual Pro pack → multi-agent CLI compatibility → teams with shared task governance → enterprise self-hosted/centralized features. Each expansion requires demand evidence and new security review.

## 13. First 48 hours (starting Monday, Oct 19)

- [ ] Decide whether to use the working product name and reserve an available repository name (do not purchase domains before checking demand).
- [ ] Create public/private code repo with `docs/`, `src/`, `tests/fixtures/`, `.guardian/` only for local demo state; add license choice and provenance notes.
- [ ] Copy this plan into `docs/MASTER_PLAN.md`, and add the companion metrics workbook as a management artifact.
- [ ] Record 10 direct/adjacent competitors and mark claims as verified/unverified.
- [ ] Invite 10 relevant developers for short interviews; schedule at least 8.
- [ ] Build one synthetic two-agent collision scenario and write the expected warning in plain English.
- [ ] Create engineering ticket G2-01 only AFTER G1 decision; avoid prematurely designing a full dashboard.

## 14. References checked 2026-10-17

- Claude Code native parallel-session workflow: https://support.claude.com/en/articles/14554000-claude-code-power-user-tips
- Claude Code extension surfaces (skills/hooks): https://claude.com/resources/articles/steering-claude-code-skills-hooks-rules-subagents-and-more
- Anthropic Agent Skills support/distribution: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Conductor workspace comparison: https://www.conductor.build/docs/guides/parallel-agents/run-multiple-claude-code-sessions
- Claude Squad repository: https://github.com/smtg-ai/claude-squad
- Vibe Kanban sunsetting statement: https://vibekanban.com/

**Change-control rule:** All milestone target or feature changes get a date, reason, new owner/target, and decision entry. Keep this document as the source of truth; the workbook tracks live execution.


## 15. G1 outcome: the ten pain points as initiatives (added 2026-10-17)

Full evidence, sources and competitor matrix are in `RESEARCH_G1.md`. Each initiative has an owner
surface: **mod** = the session-agents Claude Code mod in `plugins/session-agents`, **CLI** = the
`guardian` command, **both** = shared `.guardian/` state.

| # | Pain point (sourced) | Initiative | Surface | Gate |
|---|---|---|---|---|
| P1 | Worktrees defer conflicts to merge; hotspot files collide (41.7% cross-agent conflict rate in a 716-merge study) | Overlap report across worktrees with a hotspot-file heuristic | both | G2 |
| P2 | Silent last-write-wins overwrites in a shared checkout | Keep the mod's edit pause; switch ownership violations to ask-the-user | mod | G2 |
| P3 | No mechanism to declare or enforce per-task file ownership ("a rule with no mechanism") | Task-level claims in `.guardian/tasks.json` that outlive a session; checked at every Edit/Write | both | **G2 wedge** |
| P4 | 35–69% of "tests pass / done" claims unverified in two datasets | Handoff records test command, exit code and tree hash, or prints "not verified" | CLI | G2 late |
| P5 | Session handoff is manual (claude-code #11455, 26 votes) | `guardian handoff` Markdown + JSON | CLI | G2 late |
| P6 | Merge is the real bottleneck; merge tax is superlinear | Suggested merge order, least-overlapping first | CLI | G3 / Pro |
| P7 | Agent writes outside its declared scope; found only at review (44% wrong-tree writes in one dataset) | "Paths touched outside claim" in check and handoff | both | G2 |
| P8 | Logical conflicts that merge clean (IDs, schema, lockfiles) | Advisory hint when two tasks touch migrations, lockfiles, schema, generated files | CLI | G3 |
| P9 | Losing track of which session / worktree / branch did what | Mod pane already does this; add task → branch → commit mapping | mod | G2 |
| P10 | Merge or cleanup destroys uncommitted work; lock contention | Warn on uncommitted work and `index.lock`; Guardian never cleans or merges | both | G2 |

**Re-scoped wedge:** P3 + P1 + P7 (declare ownership, check overlap before and during work). P4, P5,
P6 are fast-follow; Radar (MIT, Oct 2026) already ships a comparable test-evidence gate, so compare
before building.

**Positioning:** preflight coordination for parallel AI coding sessions, sitting beside Conductor,
Claude Squad, worktrunk and native worktrees. Pitch: "Before two Claude sessions touch the same
files, Guardian tells you. Before you merge, it tells you what was actually tested."

**Distribution (in order):** own marketplace one-liner in this repo → Anthropic directory submission
(any paid plan; needs LICENSE, README, no binaries in the plugin) → r/ClaudeAI + Show HN + X launch
with a GIF of a collision being caught → awesome-claude-code after 14 days of commits → integration
recipes for worktrunk, ccmanager, agent-of-empires. Paid plugins have no catalog mechanism, so Pro
must be enforced by the CLI with a license key.

**New risk R8:** Radar or Anthropic absorbs the handoff / merge-readiness layer. Mitigation: own the
preflight ownership layer first; integrate with Radar rather than compete if it gains traction.

**Change-control entry:** 2026-10-17, reason: desk research and the existing session-agents mod
v0.13.0 (see `MOD_REVIEW.md`). Owner: founder. New target: G2 starts from the mod, not from an
empty CLI. Founder decision 2026-10-20: H1 (problem frequency) is treated as validated by the sourced desk research plus the founder's own parallel-session incidents, which produced the session-agents mod and the shared-checkout hook. Scheduled problem interviews are dropped. Developer feedback from here on comes from alpha testers at G3 and from public issue trackers, not from a separate interview round.

**Pricing direction (founder, 2026-10-20):** do not anchor on $29. Aim for a low price and volume:
a small one-time price in the $5–$12 band, or a few dollars a month, so that doubling a small user
count still produces meaningful revenue and the purchase is impulse-sized for someone already paying
$100–$200 a month for Claude. SessionWatcher ($6.99 / $14.99 one-time, 1,500+ users) is the closest
comparable at that level. Test two price points at G5 as the plan already allows.

**G2 progress (2026-10-20):** `guardian` CLI v0.1 implements all four core workflow commands from §4
on the shared `.guardian/tasks.json`. P0 criteria met so far: no AI key or network; read-only
`inspect` / `check` / `handoff`; writes only under `.guardian/` after a preview; argv-only git calls;
`handoff` says "not verified" without evidence and records exit code + tree fingerprint when it
runs tests itself; JSON carries `schemaVersion`; every finding has a remediation. Fixture coverage
so far: declared overlap, same-path overlap across worktrees, owned-by-other-task, outside-claim,
hotspot category, behind-base, in-flight lock, stale task, renamed path, path with a space,
untracked file, not-verified / verified / failed test evidence. Still owed for G2: the 20-fixture
count (symlinks and more rename cases), macOS + Linux smoke run, install / uninstall docs.

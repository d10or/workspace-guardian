# Checkpoint (living state; rewritten by /checkpoint, injected at every session start)

**Updated:** 2026-10-23 (evening) · **Current gate:** G3 private alpha; G1, G2 closed; G5 engineering complete · **Release:** v0.2.1 public at https://github.com/d10or/workspace-guardian (CLI 0.2.1, mod 0.18.0 on main, last release tag v0.2.1); Pro 0.1.0 private at `d10or/workspace-guardian-pro`

## Where we stopped
Engineering is done for the pilot; all five CI jobs green on `2a245fd`. The project is waiting on the
founder's outward actions, in this order, each with pre-filled values in `docs/FOUNDER_RUNBOOK.md`:
1. Lemon Squeezy store with the founding variant ($1/month) → send Claude the product URL + support email.
2. Test purchase + refund; back up `~/.config/workspace-guardian/signing-key.pem` offline.
3. Fourth demo clip (Ownership question inside Claude Code).
4. Launch posts (Reddit → Show HN → X) and the Anthropic directory submission (`docs/LAUNCH_POSTS.md`).
5. Five alpha outreach messages (`docs/ALPHA_OUTREACH.md`).
Early feedback: the founder showed the pane to people and it was received well (pane only; no
workflow completions logged; nothing in the Alpha Testers sheet yet).

## Engineering roadmap (from `docs/RESEARCH_G2_IMPROVEMENTS.md`, 2026-10-24)
First sprint, in order: R1 destructive-git guard with cross-session awareness + safety refs; R2 hold
dialog naming the owner with Ask owner / Proceed / Stop; R4 STALE evidence in handoff + refusal of
unverified "done"; R6 migrate shared state to `$.store` and sessions to `claude agents --json`.
Then R3 preflight v2 (merge-tree incl. uncommitted), R5 compaction-safe task state, R7 per-session
usage attribution, R8 permission ledger, R9 secret guard, R10 worktree lifecycle, R11 subagent paths.
Positioning change: not "a control tower" (native agent view is that) but "stops sessions destroying
each other's work, shows what collides before merge, refuses to call unverified work done".

## Claude's next actions (when the founder reports a step)
- Store URL arrives → put it in README (Pro paragraph), `src/commands/check.ts` Pro hint, `docs/LAUNCH_POSTS.md`, `docs/PRIVACY.md` (support email); push; tag v0.2.2.
- Orders → founder fulfils with `npm run fulfil`; Claude logs Weekly Metrics (gross / fees / refunds) and files feedback as issues.
- Alpha replies → issues, fix top three within the week, `/gate G3` at 4 of 5 completions.
- After launch: G4-04 free SKILL.md wrapper for Agensi.io; G4-05 "Project Continuity Kit" skill pack (checkpoint/resume/gate + hook + templates) to sell on Agensi at $9–$19, zero Pro content.

## Decisions that must not be re-litigated
- 2026-10-17: wedge = task ownership + preflight overlap; handoff/merge-readiness fast-follow (Radar exists).
- 2026-10-20: interviews dropped; H1 accepted on desk research + founder incidents.
- 2026-10-20: public repo under PolyForm Shield 1.0.0 (source-available, noncompete), superseding MIT the same day with 0 clones; paid code only in the private repo; awesome-claude-code dropped. "Fully private" reconsidered and rejected the same day.
- 2026-10-23: checkout on Lemon Squeezy only (D7, D9); manual key fulfilment during the pilot; buyers run `guardian pro install <tgz>` then `guardian license add <key>`; keys are offline Ed25519, public key in `src/lib/license.ts`.
- 2026-10-23: founding price $1/month for 30 days or 100 buyers, grandfathered (D8); then $9 one-time vs $4/month A/B. Free core stays free and public.
- 2026-10-23: Agensi.io only for free/side skills (D9, G4-04, G4-05), never Pro.
- Mod installed from GitHub (`d10or/workspace-guardian`), not the local folder. Git identity in both repos = GitHub no-reply address; never the real email.

## State of the code (runs made 2026-10-23)
- Free core 0.2.1: `npm test` 25 pass; hook test ok; CI green on ubuntu, macos, windows.
- Mod 0.18.0 (pane redesign: header, risk-first overview, Ownership card, auto theme, compact cards, legend, teaching empty states, narrow layout): `claude plugin test` 22 pass; live-confirmed on terminal, desktop app and VS Code; mobile by test kit only.
- Pro 0.1.0 (private, 615c22b): 4 tests; `npm run pack` → `release/workspace-guardian-pro-0.1.0.tgz`; `npm run fulfil` prints key + email. Verified end to end with a real signed key.
- Usage counters under `<claude config>/guardian/usage/`; `guardian usage` merges them.
- Known gaps: Windows verified by CI only; mod Jump button macOS-only; notes/pins/history still shared files; offline keys cannot be revoked instantly; the founder's saved pane theme is still "light" until they press the theme button once.

## Open questions for the founder
- Lemon Squeezy payout jurisdiction (during store setup).
- Working name "Workspace Guardian": trademark check still pending.
- Details of the early pane feedback (how many people, what they said) for the Interview Log.

# Progress log

Newest first. Gate names refer to `MASTER_PLAN.md` §5. "Evidence" is a path or command, never a claim.

## 2026-10-20 (later) — G2 closed; G3–G6 prepared

- **Done:** three terminal demo clips recorded with `demo/record.sh` (asciinema + agg), approved by
  the founder, embedded in the README. The in-Claude-Code Allow / Deny clip remains to be recorded by hand.

- **G2 closed.** Evidence: `docs/SAFETY_AUDIT.md` (P0 criteria row by row), 19 CLI tests + 16 mod
  tests + hook test green locally and in CI on ubuntu + macos, `demo/scenarios.sh` runs all three
  demo scenarios, mod v0.15.0 (G2-08 done), release tag v0.1.0.
- **G3 prepared, not closed.** `docs/ALPHA_GUIDE.md`, `docs/ALPHA_OUTREACH.md` with six named
  target threads and the message. Exit criterion (4 of 5 real testers complete the workflow, 0
  safety events) requires people; nothing internal can satisfy it.
- **G4 prepared, not closed.** Public MIT repo, `CHANGELOG.md`, `docs/PRIVACY.md`,
  `docs/RELEASE_CHECKLIST.md`, issue templates, tagged release. Exit needs the Anthropic directory
  submission (founder's claude.ai account), posted demo clips, and ≥ 50 measured installs.
- **G5 prepared, not closed.** `docs/PRICING.md`: free/Pro boundary, two price messages ($9 one-time
  vs $4/month), checkout and refund plan, license-key design. Exit needs the Pro build, a live
  checkout, and ≥ 3 real buyers.
- **G6 template ready.** `docs/DECISION_MEMO.md`. Exit is the dated decision on 2026-11-29.

## 2026-10-20 — G2 in progress

- **Done:** license MIT; repository public at https://github.com/d10or/workspace-guardian; first push
  2026-10-20. CI run 39390316230 green on ubuntu-latest, macos-latest and the mod job (G2-06, G2-07).

- **Done:** first commit on `main` (`8fe2c6b`). Repo identity set locally.
- **Done:** `guardian` CLI v0.1: `inspect`, `task add|done|list`, `check`, `handoff` on the shared
  `.guardian/tasks.json`. Evidence: `npm test` (unit + end-to-end on a two-worktree fixture repo),
  `npm run build`, `docs/../README.md` CLI table.
- **Done:** session-agents mod v0.14.1: task ownership with ask-the-user hold, per-session claim
  files, prompt-sharing opt-in, glob fix, branch cache, pid validation. Evidence:
  `claude plugin test plugins/session-agents` (15 pass), live hold observed in this session and
  logged in `~/.claude/session-agents/messages.json`.
- **Done:** Node 24.22.0 LTS installed via nvm on the dev machine.
- **Done:** fixture set extended toward the 20-fixture P0 target (see `tests/`).
- **Done:** `docs/INSTALL.md` (install, update, uninstall, troubleshooting), `.github/workflows/ci.yml`
  (Ubuntu + macOS CLI jobs; mod job runs `claude plugin validate|test`, allowed to fail until verified on CI).
- **Decision:** interview round dropped; H1 accepted on desk research + founder incidents.
- **Decision:** pricing moves to a low-price, volume model ($5–$12 one-time or a few $/month); two price points at G5.
- **Owed for G2 exit:** G2-08 mod cleanup; G2-09 demo recordings (clean repo, risky overlap, safe handoff); safety audit write-up.

## 2026-10-17 — G1 closed

- **Done:** desk research: 10 sourced pain points, 20-tool competitor matrix, positioning,
  distribution mechanics and ranked channels. Evidence: `docs/RESEARCH_G1.md`.
- **Done:** project initialised from the starter zip; plan, tracker and playbook under `docs/`.
- **Done:** existing mod (v0.13.0) and shared-checkout hook brought into the repo and reviewed.
  Evidence: `docs/MOD_REVIEW.md`. Hook bug found and fixed (no `python` on macOS).
- **Decision:** GO to G2 with the wedge re-scoped to task ownership + preflight overlap (P3, P1, P7);
  handoff and merge-readiness as fast-follow because Radar already ships a test-evidence gate (R8).

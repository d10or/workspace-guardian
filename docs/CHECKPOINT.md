# Checkpoint (living state; rewritten by /checkpoint, injected at every session start)

**Updated:** 2026-10-23 (end of day) · **Current gate:** G3 private alpha; G1, G2 closed; G5 engineering complete · **Release:** v0.2.0 public at https://github.com/d10or/workspace-guardian (CLI 0.2.1, mod 0.17.0; CI green on ubuntu, macos, windows at 7007167); Pro 0.1.0 private at `d10or/workspace-guardian-pro` (615c22b)

## Founder actions pending (nothing here can be done from a session)
- G3-02 alpha outreach: send the message in `docs/ALPHA_OUTREACH.md` to five people from its target list; log in the Alpha Testers sheet. 0 of 5 so far.
- G2-09 fourth clip: record `/task add` + the Allow / Deny question inside Claude Code (the three terminal clips are in `demo/recordings/` and the README).
- G4-03 launch: post `docs/LAUNCH_POSTS.md` (Reddit, Show HN, X, Anthropic directory at claude.ai/directory/manage).
- G5-02 store: follow `docs/CHECKOUT_LEMONSQUEEZY.md` (create store, upload `workspace-guardian-pro/release/workspace-guardian-pro-0.1.0.tgz`, test purchase + refund). Back up `~/.config/workspace-guardian/signing-key.pem` offline.
- Restart Claude Code once to load mod 0.16.0 (installed from GitHub, update applied 2026-10-23).

## In progress / blocked (engineering)
- Nothing half-done. Working tree clean at `a1cbaa2`.

## Next engineering work (in order)
1. (closed 2026-10-23) Desktop app and VS Code live-confirmed; tab-row wrap fixed (0.17.1); allowed holds now reported to the model (0.17.2). Nothing engineering-side is open; next work is driven by alpha feedback.
2. When the first alpha feedback arrives: triage into issues, fix the top three within the week, re-record clips if output text changed (`bash demo/record.sh`).
3. Only if orders exceed ~5/week: Cloudflare Worker webhook signer (design in `docs/CHECKOUT_LEMONSQUEEZY.md`).

## Decisions that must not be re-litigated
- 2026-10-20: interviews dropped; H1 accepted on desk research + founder incidents.
- 2026-10-17: wedge = task ownership + preflight overlap; handoff/merge-readiness are fast-follow (Radar exists).
- 2026-10-20: public repo under PolyForm Shield 1.0.0 (source-available, noncompete), superseding MIT the same day with 0 clones recorded; all paid code in the private repo; awesome-claude-code listing dropped. Founder reconsidered "fully private" on 2026-10-20 and chose to keep this.
- 2026-10-20: low-price volume pricing; test $9 one-time (A) vs $4/month (B) at G5.
- 2026-10-23: checkout on Lemon Squeezy; manual key fulfilment during the pilot (`npm run fulfil -- <order> <email>` in the Pro repo); buyers run `guardian pro install <tgz>` then `guardian license add <key>`. Keys are offline Ed25519; public key embedded in `src/lib/license.ts`.
- The mod is installed from GitHub (`d10or/workspace-guardian`), not the local folder. Git identity in both repos is the GitHub no-reply address; never the real email.

## State of the code (runs made 2026-10-23)
- Free core: `npm test` 25 pass; `bash tests/hook.test.sh` ok; CI green on `8b18bff` (ubuntu, macos, mod job).
- Pro (private repo): `npm test` 4 pass; `npm run pack` builds `release/*.tgz` (compiled JS only, no maps).
- Mod 0.17.0: `claude plugin test` 20 pass (incl. pane render on terminal/desktop/vscode/mobile); `claude plugin validate` clean.
- End-to-end verified today: real tarball → `guardian pro install` → key from `npm run fulfil` → `guardian license add` → `guardian check` prints the scored merge plan on `demo/scenarios.sh risky`.
- Usage counters: `<claude config>/guardian/usage/` (CLI `cli.json`, mod `mod-<session>.json`), merged by `guardian usage`; counts only, never paths.
- Known gaps: Windows verified only by CI (commit 7007167, all five jobs green), not by a human on a Windows machine yet; mod Jump button macOS-only; shell writes (`cp`, redirects) invisible to the mod's hold; notes/pins/history still shared files; offline keys cannot be revoked instantly (revoked.json ships with releases).

## Open questions for the founder
- Jurisdiction / payout details for the Lemon Squeezy store.
- Whether to keep the working name "Workspace Guardian" (trademark check pending).

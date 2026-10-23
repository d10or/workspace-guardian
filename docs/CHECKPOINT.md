# Checkpoint (living state; rewritten by /checkpoint, injected at every session start)

**Updated:** 2026-10-23 · **Current gate:** G3 private alpha (G1, G2 closed) · **Release:** v0.1.0 public at https://github.com/d10or/workspace-guardian

## In progress / blocked
- G3-02 alpha outreach: message and targets in `docs/ALPHA_OUTREACH.md`; **founder sends**. 0 of 5 testers so far.
- G2-09 fourth clip (Allow / Deny inside Claude Code): founder records by hand.
- G4 launch: posts drafted in `docs/LAUNCH_POSTS.md` (Reddit, Show HN, X thread, directory submission, awesome-claude-code line, reply guide); **founder posts**. Alpha feedback issue template added.

## Next engineering work (in order)
1. Pro packaging for buyers: build `@workspace-guardian/pro` into a tarball the checkout emails; `guardian pro install <tarball>` to place it at `<guardian home>/pro/`; checkout-provider webhook → `npm run sign`. (Pro 0.1.0 itself is built and tested, private repo commit 400c0cb.)
2. Verify the mod on the desktop app and VS Code surfaces.

## Decisions that must not be re-litigated
- Interviews dropped; H1 accepted on desk research + founder incidents (2026-10-20).
- Wedge = task ownership + preflight overlap; handoff/merge-readiness are fast-follow (Radar exists).
- License: PolyForm Shield 1.0.0 (source-available, noncompete) on the public repo since 2026-10-20, superseding MIT the same day with 0 clones recorded. Pro lives in the private repo `d10or/workspace-guardian-pro`. Low-price volume pricing ($9 one-time vs $4/month) to test at G5. awesome-claude-code listing dropped.
- The mod is installed from GitHub (`d10or/workspace-guardian`), not the local folder.

## State of the code
- CLI v0.2.0: license + Pro loader; tests green per CI (2026-10-23). Pro 0.1.0: 4 tests green in the private repo. Mod v0.16.0: 16 tests green. Usage counters live under `<claude config>/guardian/usage/` (CLI `cli.json`, mod `mod-<session>.json`), merged by `guardian usage`. Hook test green. CI green on last push (`49e34a0`).
- Known gaps: Windows unsupported; shell writes (`cp`, redirects) invisible to the mod's hold; notes/pins/history still shared files.

## Open questions for the founder
- Which checkout provider (Lemon Squeezy vs Gumroad) and which jurisdiction for tax. Needed now: the webhook that calls `npm run sign` lives with the provider choice.
- Whether to keep the working name "Workspace Guardian" (trademark check pending).

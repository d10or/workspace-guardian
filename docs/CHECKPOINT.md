# Checkpoint (living state; rewritten by /checkpoint, injected at every session start)

**Updated:** 2026-10-20 · **Current gate:** G3 private alpha (G1, G2 closed) · **Release:** v0.1.0 public at https://github.com/d10or/workspace-guardian

## In progress / blocked
- G3-02 alpha outreach: message and targets in `docs/ALPHA_OUTREACH.md`; **founder sends**. 0 of 5 testers so far.
- G2-09 fourth clip (Allow / Deny inside Claude Code): founder records by hand.
- G4 launch: directory submission, Reddit, Show HN, X posts are the founder's; drafts not yet written (`docs/LAUNCH_POSTS.md` offered).

## Next engineering work (in order)
1. `docs/LAUNCH_POSTS.md` drafts + "Alpha feedback" issue template.
2. Opt-in anonymous usage counter in the mod (off by default; counts only, no paths) for G6 metrics.
3. Pro features for G5 behind an offline license key: merge-order planner with risk score, per-repo `--strict` policies, custom hotspot rules (`docs/PRICING.md`).
4. Verify the mod on the desktop app and VS Code surfaces.

## Decisions that must not be re-litigated
- Interviews dropped; H1 accepted on desk research + founder incidents (2026-10-20).
- Wedge = task ownership + preflight overlap; handoff/merge-readiness are fast-follow (Radar exists).
- MIT, public repo, low-price volume pricing ($9 one-time vs $4/month to test at G5).
- The mod is installed from GitHub (`d10or/workspace-guardian`), not the local folder.

## State of the code
- CLI v0.1.0: 19 tests green. Mod v0.15.0: 16 tests green. Hook test green. CI green on last push (`49e34a0`).
- Known gaps: Windows unsupported; shell writes (`cp`, redirects) invisible to the mod's hold; notes/pins/history still shared files.

## Open questions for the founder
- Which checkout provider (Lemon Squeezy vs Gumroad) and which jurisdiction for tax.
- Whether to keep the working name "Workspace Guardian" (trademark check pending).

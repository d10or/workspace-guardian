# Release checklist (G4-01)

Run top to bottom for every tagged release. Tick with the evidence link.

1. [ ] `npm test`, `claude plugin test plugins/session-agents`, `bash tests/hook.test.sh` green locally.
2. [ ] CI green on `main` for ubuntu-latest and macos-latest, mod job included.
3. [ ] `plugin.json` version = `VERSION` in `register.tsx` (CI checks this) and matches `CHANGELOG.md`.
4. [ ] `CHANGELOG.md` has a dated section for the version.
5. [ ] `docs/SAFETY_AUDIT.md` re-read; any new write path or shell call added to it.
6. [ ] `docs/PRIVACY.md` still true (new files read or written?).
7. [ ] Install line in README and `docs/INSTALL.md` works from a clean machine or a fresh user account.
8. [ ] No P0/P1 issues open on GitHub.
9. [ ] `git tag -a vX.Y.Z -m ...` and `gh release create vX.Y.Z --notes-from-tag` (or pass the changelog section).
10. [ ] Demo clips (docs/DEMO.md) still match the current output; re-record if a message changed.
11. [ ] Anthropic directory listing updated (`claude.ai/directory/manage`) after the first submission.
12. [ ] Progress log and tracker updated with the release link.

# Safety audit against the P0 acceptance criteria (MASTER_PLAN.md §4)

**Date:** 2026-10-20 · **Scope:** `src/` (guardian CLI v0.1), `plugins/session-agents` (mod v0.15.0),
`scripts/git-parallel-session-check.sh` · **Method:** code reading plus the automated tests named
below. Every row cites a file and a test; "met" means the test exists and passes in CI
(https://github.com/d10or/workspace-guardian/actions).

| # | P0 criterion | Status | Evidence |
|---|---|---|---|
| 1 | Works without an AI model or API key and without network access | met | CLI imports only `node:*` modules (`src/lib/git.ts`, `src/lib/tasks.ts`); no `fetch`, no HTTP client. Mod: `claude plugin validate` lists its `$` calls; none is `$.http`. CI runs the whole suite with no secrets configured. |
| 2 | `inspect` and `check` never change tracked source files | met | Both commands only call `git` read subcommands (`rev-parse`, `status`, `diff --name-only`, `worktree list`, `rev-list`, `for-each-ref`, `log`). `tests/cli.test.ts` asserts `git status --porcelain` is unchanged except for `.guardian/` after `inspect`, `check`, and `handoff`. |
| 3 | Any state creation is explicit, scoped to `.guardian/`, previewed, documented | met | `task add` previews then asks for confirmation unless `--yes`; non-TTY without `--yes` refuses and writes nothing (`tests/cli.test.ts` "needs confirmation"). Writes go through `saveTasks` (temp file + rename) to `<main worktree>/.guardian/tasks.json` only. `handoff --out` writes exactly the path the user names. Documented in README and `docs/INSTALL.md`. |
| 4 | `check` catches every fixture with exact overlapping declared globs and competing changed paths; acknowledges unknown future edits | met | Declared overlap: `tests/cli.test.ts` (AUTH vs AUTH2), `tests/tasks.test.ts`. Changed-path overlap: `tests/cli.test.ts` (src/auth/a.ts in two worktrees). Human and JSON output carry the advisory "unknown future edits are not covered" (`src/lib/output.ts`, `src/commands/check.ts`). |
| 5 | `handoff` never claims tests passed unless verifiable output was supplied; emits "not verified" otherwise | met | `src/commands/handoff.ts`: `verified` only when guardian ran the command itself and it exited 0, recorded with exit code, duration and a tree fingerprint; `failed` with the exit code; `supplied, not verified` for `--evidence`; `not verified` otherwise. Tested in `tests/cli.test.ts` and `tests/fixtures.test.ts`. |
| 6 | No shell-string execution from untrusted input; safe path handling; no arbitrary repo command execution; no secret logging | met with one documented exception | All git calls use `execFile("git", [...argv])` (`src/lib/git.ts`); paths from `git status -z` are NUL-separated and never interpolated; odd names tested (space, unicode, quotes). Exception: `handoff --run '<cmd>'` runs the user's own test command: split on whitespace and executed with `execFile` without a shell on macOS/Linux; through the shell on Windows (since 0.2.1) because `npm`/`npx` are `.cmd` shims that only resolve that way. It is the user's input on their own machine, documented in README. The mod's `sh -c` calls carry fixed strings only (`ensurePaths`); AppleScript strings are whitelisted to `[A-Za-z0-9 _.-]` (`jumpTo`). The CLI logs nothing; the mod shares prompt text only behind an opt-in toggle, default off. |
| 7 | Structured JSON output schema is versioned; human output has precise remediation | met | Every JSON object carries `schemaVersion: 1` (`src/lib/output.ts`); every finding has a `fix` string, printed as "fix:" in human output. |
| 8 | ≥ 20 automated fixtures, macOS/Linux smoke tests, install/uninstall instructions, 0 P0/P1 known bugs at public beta | met for fixtures and smoke; beta bug count is a G4 check | 19 CLI tests (several contain multiple fixture repos), 16 mod tests, 1 hook regression test; CI green on ubuntu-latest and macos-latest (run 39390316230 and later). `docs/INSTALL.md` covers install, update, uninstall. Known bugs: none open at P0/P1 (see GitHub issues). |

## Hard limits from §1

- No production or customer secrets in tests: fixtures are generated in temp dirs with synthetic content (`tests/fixture.ts`).
- Read-only analysis by default: see rows 2 and 3.
- No unattended merges, destructive git commands, or source edits: `grep -rn "merge\|rebase\|checkout\|reset\|push" src/` finds only strings in messages and the `merge-tree`-free analysis; no such git subcommand is invoked. The mod's git calls are `rev-parse`, `status`, `worktree list`, `rev-list`, `branch --merged`, `symbolic-ref`, `log`, `for-each-ref`, `diff --stat`, `stash list`, `worktree prune --dry-run`.

## Residual risks (tracked in the risk register)

- R2/R3: hotspot and scope heuristics are advisory; false positives and misses are expected and labelled as such in every output.
- Shell writes (`cp`, redirects) by an agent are invisible to the mod's edit hold, the same blind spot Claude Code's own worktree guard documents. The CLI's `check` sees them afterwards via `git status`.
- The mod stores file paths and message text in plain text under the Claude config folder (documented in `docs/SESSION_AGENTS_MOD.md`).

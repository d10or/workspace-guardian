#!/usr/bin/env node
/**
 * guardian — CLI entry point.
 *
 * Safety contract (docs/MASTER_PLAN.md §4):
 *  - `inspect`, `check`, `handoff` (without --out) are read-only.
 *  - `task add|done` write only <main worktree>/.guardian/tasks.json, after a preview and confirmation.
 *  - Never checkout, rebase, merge, push, reset, or delete on the user's behalf.
 *  - Git is called with argv arrays, never a shell string.
 */

import { inspect } from "./commands/inspect.ts";
import { taskAdd, taskDone, taskList } from "./commands/task.ts";
import { check } from "./commands/check.ts";
import { handoff } from "./commands/handoff.ts";
import { usage } from "./commands/usage.ts";

const USAGE = `guardian — coordinate parallel AI coding sessions on one repo

Usage:
  guardian inspect [--json] [--base <ref>]
      Branch, working tree, every worktree, and which worktree carries each task. Read-only.
  guardian task add --id <ID> --paths <glob[,glob]> [--branch <name>] [--note <text>] [--yes]
      Declare that a task owns paths on a branch. Writes .guardian/tasks.json after a preview.
  guardian task done --id <ID>        Release a task's paths.
  guardian task list [--all] [--json] Show declared tasks and declared overlaps.
  guardian check [--json] [--base <ref>] [--strict]
      Declared overlaps, same-path changes across worktrees, scope violations, hotspot files,
      stale base, in-flight git operations, stale tasks. Advisory. --strict exits 3 on risks.
  guardian handoff --task <ID> [--run '<test command>'] [--evidence <file>] [--out <path>] [--json]
      Markdown/JSON report: branch, commit, changed paths, test evidence or "not verified",
      open risks, next steps. Read-only unless --out is given.
  guardian usage [--json] [--reset]
      Local usage counts (no paths, nothing sent) to share voluntarily. GUARDIAN_NO_USAGE=1 disables.

The same .guardian/tasks.json is read and written by the session-agents Claude Code mod (/task).
`;

export async function main(argv: readonly string[]): Promise<number> {
  const [command, ...rest] = argv;
  switch (command) {
    case "inspect":
      return inspect(rest);
    case "task":
      if (rest[0] === "add") return taskAdd(rest.slice(1));
      if (rest[0] === "done") return taskDone(rest.slice(1));
      if (rest[0] === "list" || rest[0] === undefined) return taskList(rest.slice(1));
      process.stderr.write(`Unknown task subcommand: ${rest[0]}\n\n${USAGE}`);
      return 2;
    case "check":
      return check(rest);
    case "handoff":
      return handoff(rest);
    case "usage":
      return usage(rest);
    case undefined:
    case "-h":
    case "--help":
    case "help":
      process.stdout.write(USAGE);
      return 0;
    case "--version":
      process.stdout.write("guardian 0.1.1\n");
      return 0;
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
      return 2;
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: unknown) => {
    process.stderr.write(`guardian: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  },
);

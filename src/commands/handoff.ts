/**
 * `guardian handoff --task ID` — what was done, where, with what evidence. Never claims tests
 * passed unless it ran them itself or was handed verifiable output; otherwise says "not verified".
 */
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { analyze, taskForWorktree } from "../lib/analyze.ts";
import { loadContext, NotARepo, touchedPaths, type WorktreeView } from "../lib/context.ts";
import { git, treeFingerprint } from "../lib/git.ts";
import { activeTasks, globMatches } from "../lib/tasks.ts";
import { eprintln, json, parse, println, SCHEMA_VERSION, type Finding } from "../lib/output.ts";
import { localBranches } from "./check.ts";
import { record } from "../lib/usage.ts";

type TestEvidence =
  | { status: "verified"; command: string; exitCode: number; durationMs: number; fingerprint: string; tail: string }
  | { status: "failed"; command: string; exitCode: number; durationMs: number; fingerprint: string; tail: string }
  | { status: "supplied"; file: string; note: string }
  | { status: "not verified"; note: string };

function runTests(argv: string[], cwd: string): Promise<{ exitCode: number; durationMs: number; output: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    // On Windows, `npm` / `npx` / `pnpm` are .cmd shims that only resolve through the shell. The command is the
    // user's own (--run), so a shell there is their input, not untrusted data; documented in SAFETY_AUDIT.md.
    const win = process.platform === "win32";
    const cb = (err: any, stdout: string | Buffer, stderr: string | Buffer) => {
      const code = err && typeof (err as { code?: unknown }).code === "number" ? (err as { code: number }).code : err ? 1 : 0;
      resolve({ exitCode: code, durationMs: Date.now() - start, output: `${stdout}${stderr}` });
    };
    if (win) execFile(argv.join(" "), [], { cwd, maxBuffer: 32 * 1024 * 1024, timeout: 30 * 60 * 1000, shell: true }, cb);
    else execFile(argv[0]!, argv.slice(1), { cwd, maxBuffer: 32 * 1024 * 1024, timeout: 30 * 60 * 1000 }, cb);
  });
}

export async function handoff(args: readonly string[]): Promise<number> {
  const a = parse(args, {
    task: { type: "string" },
    run: { type: "string" },
    evidence: { type: "string" },
    out: { type: "string" },
    json: { type: "boolean", default: false },
    base: { type: "string" },
  });
  if (!a.ok || !a.values.task) {
    eprintln(`guardian handoff: ${a.ok ? "need --task <ID>" : a.error}\nUsage: guardian handoff --task TASK-01 [--run 'npm test'] [--evidence test.log] [--out report.md] [--json]`);
    return 2;
  }
  let ctx;
  try {
    ctx = await loadContext(process.cwd(), a.values.base);
  } catch (err) {
    eprintln(`guardian handoff: ${err instanceof NotARepo ? err.message : String(err)}`);
    return 1;
  }
  const task = activeTasks(ctx.tasks).find((t) => t.id === a.values.task) ?? ctx.tasks.find((t) => t.id === a.values.task);
  if (task === undefined) {
    eprintln(`guardian handoff: no task "${a.values.task}" in ${ctx.tasksFile}`);
    return 1;
  }
  const wt: WorktreeView | undefined = ctx.worktrees.find((w) => task.branch !== "" && w.branch === task.branch) ?? ctx.worktrees.find((w) => w.isHere);
  if (wt === undefined) {
    eprintln("guardian handoff: could not find a worktree for this task");
    return 1;
  }
  const touched = touchedPaths(wt);
  const outside = touched.filter((p) => !task.paths.some((g) => globMatches(g, p)));
  const findings = analyze(ctx, await localBranches(ctx.root)).filter((f) => f.tasks?.includes(task.id) || f.worktrees?.includes(wt.path));

  let tests: TestEvidence;
  if (a.values.run) {
    const argv = a.values.run.split(/\s+/).filter(Boolean);
    const fingerprint = await treeFingerprint(wt.path);
    const r = await runTests(argv, wt.path);
    const tail = r.output.split("\n").slice(-15).join("\n").trim();
    tests = r.exitCode === 0
      ? { status: "verified", command: a.values.run, exitCode: 0, durationMs: r.durationMs, fingerprint, tail }
      : { status: "failed", command: a.values.run, exitCode: r.exitCode, durationMs: r.durationMs, fingerprint, tail };
  } else if (a.values.evidence) {
    let note = "supplied by the user; guardian did not run it and cannot tell whether it matches the current tree";
    try {
      const text = readFileSync(a.values.evidence, "utf8");
      note += ` (${text.split("\n").length} lines)`;
    } catch {
      note = `file ${a.values.evidence} could not be read`;
    }
    tests = { status: "supplied", file: a.values.evidence, note };
  } else {
    tests = { status: "not verified", note: "no test run was supplied; pass --run '<command>' to have guardian run and record one" };
  }

  const log = await git(["log", "--oneline", "-n", "20", ctx.base ? `${ctx.base}..HEAD` : "HEAD"], wt.path);
  const commits = log.ok ? log.stdout.trim().split("\n").filter(Boolean) : [];
  const report = {
    schemaVersion: SCHEMA_VERSION,
    command: "handoff",
    generatedAt: new Date().toISOString(),
    task: { id: task.id, paths: task.paths, branch: task.branch, note: task.note, status: task.status },
    worktree: wt.path,
    branch: wt.branch,
    head: wt.head,
    base: ctx.base || null,
    ahead: wt.ahead,
    behind: wt.behind,
    commits,
    changedPaths: touched,
    uncommitted: wt.changes.map((c) => ({ path: c.path, kind: c.kind })),
    outsideClaim: outside,
    tests,
    openRisks: findings,
    nextSteps: nextSteps(wt, ctx.base, tests, findings, outside),
  };

  record("handoff");
  if (tests.status === "verified") record("handoff_verified");
  const md = toMarkdown(report);
  if (a.values.out) {
    mkdirSync(path.dirname(path.resolve(a.values.out)), { recursive: true });
    writeFileSync(a.values.out, a.values.json ? JSON.stringify(report, null, 2) + "\n" : md);
    println(`wrote ${a.values.out}`);
  } else if (a.values.json) json(report);
  else println(md.trimEnd());
  return 0;
}

function nextSteps(wt: WorktreeView, base: string, tests: TestEvidence, findings: Finding[], outside: string[]): string[] {
  const steps: string[] = [];
  if (wt.changes.length) steps.push(`commit or stash the ${wt.changes.length} uncommitted change${wt.changes.length === 1 ? "" : "s"} in ${wt.path}`);
  if (wt.behind) steps.push(`bring ${wt.branch} up to date with ${base} (${wt.behind} behind) and re-run tests`);
  if (tests.status !== "verified") steps.push(tests.status === "failed" ? `fix the failing tests (exit ${tests.exitCode}) before merging` : "run the test suite after the last edit and record it: guardian handoff --run '<command>'");
  for (const f of findings.filter((x) => x.level === "risk")) steps.push(f.fix);
  if (outside.length) steps.push(`decide whether the ${outside.length} path${outside.length === 1 ? "" : "s"} outside the claim belong to this task`);
  steps.push("review the diff yourself; guardian never merges, rebases, or pushes");
  return steps;
}

function toMarkdown(r: ReturnType<typeof Object> & Record<string, any>): string {
  const t = r.tests as TestEvidence;
  const testLine =
    t.status === "verified" ? `**verified**: \`${t.command}\` exited 0 in ${(t.durationMs / 1000).toFixed(1)}s on tree ${t.fingerprint}`
    : t.status === "failed" ? `**FAILED**: \`${t.command}\` exited ${t.exitCode} in ${(t.durationMs / 1000).toFixed(1)}s on tree ${t.fingerprint}`
    : t.status === "supplied" ? `**supplied, not verified**: ${t.file} — ${t.note}`
    : `**not verified** — ${t.note}`;
  const lines = [
    `# Handoff: ${r.task.id}`,
    "",
    `_generated ${r.generatedAt} by guardian · advisory, not a merge approval_`,
    "",
    `| | |`,
    `|---|---|`,
    `| task | ${r.task.id} owns ${r.task.paths.map((p: string) => `\`${p}\``).join(", ")} on \`${r.task.branch || "any branch"}\` |`,
    `| branch | \`${r.branch}\` @ ${r.head || "(no commits)"}${r.base ? ` · ${r.ahead} ahead, ${r.behind} behind \`${r.base}\`` : ""} |`,
    `| worktree | \`${r.worktree}\` |`,
    `| tests | ${testLine} |`,
    "",
    `## Commits since base (${r.commits.length})`,
    ...(r.commits.length ? r.commits.map((c: string) => `- ${c}`) : ["- none"]),
    "",
    `## Changed paths (${r.changedPaths.length})`,
    ...(r.changedPaths.length ? r.changedPaths.map((p: string) => `- \`${p}\`${r.uncommitted.some((u: { path: string }) => u.path === p) ? " _(uncommitted)_" : ""}${r.outsideClaim.includes(p) ? " **outside claim**" : ""}`) : ["- none"]),
    "",
    `## Open risks (${r.openRisks.length})`,
    ...(r.openRisks.length ? r.openRisks.map((f: Finding) => `- **${f.level}** ${f.message}\n  - fix: ${f.fix}`) : ["- none found (unknown future edits are not covered)"]),
    "",
    "## Next steps",
    ...r.nextSteps.map((s: string, i: number) => `${i + 1}. ${s}`),
  ];
  if (t.status === "verified" || t.status === "failed") lines.push("", "## Test output (tail)", "```", t.tail || "(no output)", "```");
  return lines.join("\n") + "\n";
}

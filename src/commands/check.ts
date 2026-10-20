/** `guardian check` — overlap, scope, hotspot, divergence, and stale-task report. Read-only, advisory. */
import { analyze, suggestedOrder } from "../lib/analyze.ts";
import { loadContext, NotARepo } from "../lib/context.ts";
import { git } from "../lib/git.ts";
import { activeTasks } from "../lib/tasks.ts";
import { eprintln, json, parse, printFindings, println, SCHEMA_VERSION } from "../lib/output.ts";

export async function localBranches(cwd: string): Promise<Set<string>> {
  const r = await git(["for-each-ref", "--format=%(refname:short)", "refs/heads"], cwd);
  return new Set(r.ok ? r.stdout.split("\n").filter(Boolean) : []);
}

export async function check(args: readonly string[]): Promise<number> {
  const a = parse(args, { json: { type: "boolean", default: false }, base: { type: "string" }, strict: { type: "boolean", default: false } });
  if (!a.ok) {
    eprintln(`guardian check: ${a.error}`);
    return 2;
  }
  let ctx;
  try {
    ctx = await loadContext(process.cwd(), a.values.base);
  } catch (err) {
    eprintln(`guardian check: ${err instanceof NotARepo ? err.message : String(err)}`);
    return 1;
  }
  const findings = analyze(ctx, await localBranches(ctx.root));
  const order = suggestedOrder(ctx.tasks, findings);
  const risks = findings.filter((f) => f.level === "risk").length;
  if (a.values.json) {
    json({ schemaVersion: SCHEMA_VERSION, command: "check", root: ctx.root, base: ctx.base || null, worktrees: ctx.worktrees.length, tasks: activeTasks(ctx.tasks).length, findings, suggestedOrder: order, advisory: "Risk, not proof. Edits that have not happened yet are not covered." });
  } else {
    println(`guardian check · ${ctx.worktrees.length} worktree${ctx.worktrees.length === 1 ? "" : "s"} · ${activeTasks(ctx.tasks).length} active task${activeTasks(ctx.tasks).length === 1 ? "" : "s"} · base ${ctx.base || "unknown (pass --base)"}`);
    println();
    printFindings(findings);
    if (order.length > 1) {
      println();
      println(`suggested merge order (least entangled first): ${order.map((o) => `${o.id}${o.score ? ` (${o.score})` : ""}`).join(" → ")}`);
    }
  }
  return a.values.strict && risks > 0 ? 3 : 0;
}

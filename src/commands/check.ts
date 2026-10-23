/** `guardian check` — overlap, scope, hotspot, divergence, and stale-task report. Read-only, advisory. */
import { analyze, suggestedOrder } from "../lib/analyze.ts";
import { loadContext, NotARepo } from "../lib/context.ts";
import { git } from "../lib/git.ts";
import { activeTasks } from "../lib/tasks.ts";
import { eprintln, json, parse, printFindings, println, SCHEMA_VERSION } from "../lib/output.ts";
import { record } from "../lib/usage.ts";
import { loadPro } from "../lib/pro.ts";
import { touchedPaths } from "../lib/context.ts";

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
  const pro = await loadPro();
  const policy = pro.module?.loadPolicy?.(ctx.mainRoot) ?? null;
  let findings = analyze(ctx, await localBranches(ctx.root), pro.module?.hotspots?.(ctx.mainRoot) ?? []);
  let failOn: string[] | null = null;
  if (pro.module?.applyPolicy) {
    const applied = pro.module.applyPolicy(findings, policy);
    findings = applied.findings;
    failOn = applied.failOn;
  }
  const order = suggestedOrder(ctx.tasks, findings);
  const plan = pro.module?.mergePlan?.({
    base: ctx.base,
    tasks: activeTasks(ctx.tasks).map((t) => ({ id: t.id, branch: t.branch, paths: t.paths })),
    worktrees: ctx.worktrees.map((w) => ({ path: w.path, branch: w.branch, ahead: w.ahead, behind: w.behind, changed: touchedPaths(w).length })),
    findings,
  }) ?? null;
  const risks = failOn ? findings.filter((f) => failOn!.includes(f.code)).length : findings.filter((f) => f.level === "risk").length;
  record("check");
  if (risks > 0) record("check_with_risks");
  if (a.values.json) {
    json({ schemaVersion: SCHEMA_VERSION, command: "check", root: ctx.root, base: ctx.base || null, worktrees: ctx.worktrees.length, tasks: activeTasks(ctx.tasks).length, findings, suggestedOrder: order, pro: pro.module ? { version: pro.module.version, policy, plan } : null, advisory: "Risk, not proof. Edits that have not happened yet are not covered." });
  } else {
    println(`guardian check · ${ctx.worktrees.length} worktree${ctx.worktrees.length === 1 ? "" : "s"} · ${activeTasks(ctx.tasks).length} active task${activeTasks(ctx.tasks).length === 1 ? "" : "s"} · base ${ctx.base || "unknown (pass --base)"}`);
    println();
    printFindings(findings);
    if (plan) {
      println();
      println(`merge plan (Pro ${pro.module!.version}):`);
      for (const o of plan.order) println(`  ${o.id.padEnd(12)} ${o.branch.padEnd(24)} risk ${o.score}${o.reasons.length ? `  ${o.reasons.join("; ")}` : ""}`);
      plan.steps.forEach((s, i) => println(`  ${i + 1}. ${s}`));
      if (failOn) println(`  policy: fail on ${failOn.join(", ")}`);
    } else if (order.length > 1) {
      println();
      println(`suggested merge order (least entangled first): ${order.map((o) => `${o.id}${o.score ? ` (${o.score})` : ""}`).join(" → ")}`);
      println("  (Pro adds a scored merge plan with rebase steps, per-repo policies and hotspot packs: guardian license show)");
    }
    if (pro.note) println(`  note: ${pro.note}`);
  }
  return a.values.strict && risks > 0 ? 3 : 0;
}

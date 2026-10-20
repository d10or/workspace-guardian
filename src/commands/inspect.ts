/** `guardian inspect` — branch, working tree, other worktrees, task ↔ worktree map. Read-only. */
import { loadContext, NotARepo, touchedPaths } from "../lib/context.ts";
import { activeTasks } from "../lib/tasks.ts";
import { eprintln, json, parse, println, SCHEMA_VERSION } from "../lib/output.ts";

export async function inspect(args: readonly string[]): Promise<number> {
  const a = parse(args, { json: { type: "boolean", default: false }, base: { type: "string" } });
  if (!a.ok) {
    eprintln(`guardian inspect: ${a.error}`);
    return 2;
  }
  let ctx;
  try {
    ctx = await loadContext(process.cwd(), a.values.base);
  } catch (err) {
    eprintln(`guardian inspect: ${err instanceof NotARepo ? err.message : String(err)}`);
    return 1;
  }
  const tasks = activeTasks(ctx.tasks).map((t) => ({
    ...t,
    worktree: ctx.worktrees.find((w) => w.branch === t.branch)?.path ?? null,
  }));
  if (a.values.json) {
    json({
      schemaVersion: SCHEMA_VERSION,
      command: "inspect",
      root: ctx.root,
      branch: ctx.branch,
      head: ctx.head,
      base: ctx.base || null,
      tasksFile: ctx.tasksFile,
      worktrees: ctx.worktrees.map((w) => ({ path: w.path, branch: w.branch, head: w.head, isHere: w.isHere, locked: w.locked, changed: touchedPaths(w).length, uncommitted: w.changes.length, ahead: w.ahead, behind: w.behind, inFlight: w.inFlight })),
      tasks,
    });
    return 0;
  }
  println(`repo      ${ctx.root}`);
  println(`branch    ${ctx.branch} @ ${ctx.head || "(no commits)"}${ctx.base ? `   base ${ctx.base}` : "   base unknown (pass --base)"}`);
  println(`tasks     ${ctx.tasksFile}${ctx.tasks.length === 0 ? " (none declared)" : ""}`);
  println();
  println("worktrees");
  for (const w of ctx.worktrees) {
    const flags = [
      w.changes.length ? `±${w.changes.length} uncommitted` : "clean",
      w.committed.length ? `${w.committed.length} path${w.committed.length === 1 ? "" : "s"} committed since base` : "",
      w.ahead ? `↑${w.ahead}` : "",
      w.behind ? `↓${w.behind} behind base` : "",
      w.locked !== null ? `locked${w.locked ? `: ${w.locked}` : ""}` : "",
      ...w.inFlight.map((f) => `IN FLIGHT: ${f}`),
    ].filter(Boolean);
    println(`  ${w.isHere ? "▸" : " "} ${w.branch.padEnd(28)} ${flags.join(" · ")}`);
    println(`      ${w.path}`);
  }
  if (tasks.length) {
    println();
    println("tasks");
    for (const t of tasks) println(`    ${t.id.padEnd(12)} ${t.paths.join(", ")}  on ${t.branch || "any branch"}${t.worktree ? `  → ${t.worktree}` : t.branch ? "  (no worktree has this branch checked out)" : ""}`);
  }
  return 0;
}

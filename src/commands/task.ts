/** `guardian task add|done|list` — the only commands that write, and only under .guardian/. */
import { createInterface } from "node:readline/promises";
import { loadContext, NotARepo } from "../lib/context.ts";
import { activeTasks, ID_RE, normalizePath, saveTasks, tasksOverlap, type Task } from "../lib/tasks.ts";
import { eprintln, json, parse, println, SCHEMA_VERSION, splitList } from "../lib/output.ts";

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

export async function taskAdd(args: readonly string[]): Promise<number> {
  const a = parse(args, {
    id: { type: "string" },
    paths: { type: "string" },
    branch: { type: "string" },
    note: { type: "string", default: "" },
    owner: { type: "string", default: "" },
    yes: { type: "boolean", short: "y", default: false },
    json: { type: "boolean", default: false },
  });
  if (!a.ok || !a.values.id || !a.values.paths) {
    eprintln(`guardian task add: ${a.ok ? "need --id and --paths" : a.error}\nUsage: guardian task add --id TASK-01 --paths 'src/auth/**,src/db' [--branch feature/auth] [--note text] [--yes]`);
    return 2;
  }
  if (!ID_RE.test(a.values.id)) {
    eprintln(`guardian task add: id "${a.values.id}" must be 1-40 letters, digits, dot, dash or underscore`);
    return 2;
  }
  const paths = [...new Set(splitList(a.values.paths).map(normalizePath))].filter(Boolean).slice(0, 20);
  if (paths.length === 0) {
    eprintln("guardian task add: --paths needs at least one path or glob");
    return 2;
  }
  let ctx;
  try {
    ctx = await loadContext(process.cwd());
  } catch (err) {
    eprintln(`guardian task add: ${err instanceof NotARepo ? err.message : String(err)}`);
    return 1;
  }
  const branch = a.values.branch ?? (ctx.branch.startsWith("(") ? "" : ctx.branch);
  if (activeTasks(ctx.tasks).some((t) => t.id === a.values.id)) {
    eprintln(`guardian task add: task ${a.values.id} already exists and is active; run 'guardian task done --id ${a.values.id}' first`);
    return 1;
  }
  const task: Task = { id: a.values.id, paths, branch, owner: a.values.owner, note: a.values.note.slice(0, 200), createdAt: Date.now(), status: "active" };
  const next = [...ctx.tasks.filter((t) => t.id !== task.id), task];
  const overlaps = tasksOverlap(next).filter((o) => o.a.id === task.id || o.b.id === task.id);

  const say = a.values.json ? eprintln : println; // keep stdout clean for --json
  say(`will write ${ctx.tasksFile}`);
  say(`  task    ${task.id}`);
  say(`  owns    ${paths.join(", ")}`);
  say(`  branch  ${branch || "(any branch: informational only, never blocks)"}`);
  if (task.note) say(`  note    ${task.note}`);
  for (const o of overlaps) say(`  ! overlaps task ${o.a.id === task.id ? o.b.id : o.a.id} on ${o.on}; narrow the paths or sequence the work`);
  if (!a.values.yes) {
    if (!(await confirm("write it?"))) {
      eprintln("not written (pass --yes to skip the confirmation)");
      return 1;
    }
  }
  saveTasks(ctx.tasksFile, next);
  if (a.values.json) json({ schemaVersion: SCHEMA_VERSION, command: "task add", file: ctx.tasksFile, task, overlaps: overlaps.map((o) => ({ with: o.a.id === task.id ? o.b.id : o.a.id, on: o.on })) });
  else println(`written. ${overlaps.length ? "declared overlap recorded; 'guardian check' will keep reporting it." : "no declared overlaps."}`);
  return 0;
}

export async function taskDone(args: readonly string[]): Promise<number> {
  const a = parse(args, { id: { type: "string" }, json: { type: "boolean", default: false } });
  if (!a.ok || !a.values.id) {
    eprintln(`guardian task done: ${a.ok ? "need --id" : a.error}`);
    return 2;
  }
  let ctx;
  try {
    ctx = await loadContext(process.cwd());
  } catch (err) {
    eprintln(`guardian task done: ${String(err instanceof Error ? err.message : err)}`);
    return 1;
  }
  if (!activeTasks(ctx.tasks).some((t) => t.id === a.values.id)) {
    eprintln(`guardian task done: no active task "${a.values.id}"`);
    return 1;
  }
  const next = ctx.tasks.map((t) => (t.id === a.values.id ? { ...t, status: "done" as const } : t));
  saveTasks(ctx.tasksFile, next);
  if (a.values.json) json({ schemaVersion: SCHEMA_VERSION, command: "task done", file: ctx.tasksFile, id: a.values.id });
  else println(`task ${a.values.id} marked done; its paths are released`);
  return 0;
}

export async function taskList(args: readonly string[]): Promise<number> {
  const a = parse(args, { json: { type: "boolean", default: false }, all: { type: "boolean", default: false } });
  if (!a.ok) {
    eprintln(`guardian task list: ${a.error}`);
    return 2;
  }
  let ctx;
  try {
    ctx = await loadContext(process.cwd());
  } catch (err) {
    eprintln(`guardian task list: ${String(err instanceof Error ? err.message : err)}`);
    return 1;
  }
  const list = a.values.all ? ctx.tasks : activeTasks(ctx.tasks);
  if (a.values.json) {
    json({ schemaVersion: SCHEMA_VERSION, command: "task list", file: ctx.tasksFile, tasks: list, overlaps: tasksOverlap(ctx.tasks).map((o) => ({ a: o.a.id, b: o.b.id, on: o.on })) });
    return 0;
  }
  if (list.length === 0) {
    println(`no ${a.values.all ? "" : "active "}tasks in ${ctx.tasksFile}`);
    return 0;
  }
  for (const t of list) println(`${t.status === "done" ? "✓" : "●"} ${t.id.padEnd(12)} ${t.paths.join(", ")}  on ${t.branch || "any branch"}${t.owner ? `  by ${t.owner}` : ""}${t.note ? `  — ${t.note}` : ""}`);
  for (const o of tasksOverlap(ctx.tasks)) println(`! ${o.a.id} and ${o.b.id} both claim ${o.on}`);
  return 0;
}

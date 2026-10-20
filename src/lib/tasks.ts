/**
 * Task-level ownership shared with the session-agents mod. Same file, same semantics:
 * <main worktree>/.guardian/tasks.json, { version: 1, tasks: [...] }.
 * Keep the glob and violation rules identical to plugins/session-agents/hooks/tasks.ts.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export const TASKS_VERSION = 1;

export type TaskStatus = "active" | "done";
export type Task = { id: string; paths: string[]; branch: string; owner: string; note: string; createdAt: number; status: TaskStatus };

/** `*` within one segment, `**` across segments (including zero), `?` one char; a bare path matches itself and everything under it. */
export function globMatches(pattern: string, rel: string): boolean {
  const p = pattern.trim().replace(/^\.\//, "").replace(/\/+$/, "");
  if (p === "" || rel === "") return false;
  if (!/[*?]/.test(p)) return rel === p || rel.startsWith(p + "/");
  let re = "";
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "*") {
      if (p[i + 1] === "*") {
        i++;
        if (p[i + 1] === "/") {
          i++;
          re += "(?:.*/)?";
        } else re += ".*";
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else re += c!.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`).test(rel);
}

export const patternsOverlap = (a: string, b: string) => a === b || globMatches(a, b) || globMatches(b, a);

export function taskFilePath(gitCommonDir: string): string {
  const clean = gitCommonDir.replace(/\/+$/, "");
  const parent = clean.endsWith("/.git") ? clean.slice(0, -"/.git".length) : clean;
  return path.join(parent, ".guardian", "tasks.json");
}

export function parseTasks(text: string): Task[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const list: unknown[] = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && Array.isArray((parsed as { tasks?: unknown }).tasks) ? (parsed as { tasks: unknown[] }).tasks : [];
  return list.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || r.id === "" || !Array.isArray(r.paths)) return [];
    const paths = r.paths.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim());
    if (paths.length === 0) return [];
    return [{
      id: r.id,
      paths,
      branch: typeof r.branch === "string" ? r.branch : "",
      owner: typeof r.owner === "string" ? r.owner : "",
      note: typeof r.note === "string" ? r.note : "",
      createdAt: typeof r.createdAt === "number" ? r.createdAt : 0,
      status: r.status === "done" ? "done" : "active",
    } satisfies Task];
  });
}

export const serializeTasks = (tasks: readonly Task[]) => JSON.stringify({ version: TASKS_VERSION, tasks }, null, 2) + "\n";

export function loadTasks(file: string): Task[] {
  try {
    return parseTasks(readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

/** Atomic write: temp file then rename, so a reader never sees a half-written file. */
export function saveTasks(file: string, tasks: readonly Task[]): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, serializeTasks(tasks));
  renameSync(tmp, file);
}

export const activeTasks = (tasks: readonly Task[]) => tasks.filter((t) => t.status === "active");

/** The active task whose paths cover `rel` while `branch` is not its branch. Branch-less tasks never block. */
export function findViolation(tasks: readonly Task[], rel: string, branch: string): Task | undefined {
  return tasks.find((t) => t.status === "active" && t.branch !== "" && t.branch !== branch && t.paths.some((p) => globMatches(p, rel)));
}

export function tasksOverlap(tasks: readonly Task[]): { a: Task; b: Task; on: string }[] {
  const active = activeTasks(tasks);
  const hits: { a: Task; b: Task; on: string }[] = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!;
      const b = active[j]!;
      const on = a.paths.find((pa) => b.paths.some((pb) => patternsOverlap(pa, pb)));
      if (on !== undefined) hits.push({ a, b, on });
    }
  }
  return hits;
}

export const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

export const normalizePath = (p: string) => p.trim().replace(/^\.\//, "").replace(/\/+$/, "");

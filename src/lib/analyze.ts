/**
 * The risk analysis behind `guardian check` and the "open risks" of `guardian handoff`.
 * Advisory by design: it flags risk, it never asserts a merge is safe.
 */
import { HOTSPOTS, type Hotspot } from "./hotspots.ts";
import { globMatches as gm } from "./tasks.ts";
import { activeTasks, findViolation, globMatches, tasksOverlap, type Task } from "./tasks.ts";
import type { Finding } from "./output.ts";
import type { RepoContext, WorktreeView } from "./context.ts";
import { touchedPaths } from "./context.ts";

const short = (p: string) => p.replace(/^.*[\\/]/, "");
const wtName = (w: WorktreeView) => `${w.branch} (${short(w.path)})`;

export function taskForWorktree(tasks: readonly Task[], w: WorktreeView): Task | undefined {
  return activeTasks(tasks).find((t) => t.branch !== "" && t.branch === w.branch);
}

export function analyze(ctx: RepoContext, knownBranches: ReadonlySet<string>, extraHotspots: readonly Hotspot[] = []): Finding[] {
  const hotspots = [...HOTSPOTS, ...extraHotspots];
  const hotspotOf = (rel: string) => hotspots.find((h) => h.patterns.some((p) => gm(p, rel)));
  const out: Finding[] = [];
  const live = ctx.worktrees.filter((w) => !w.prunable && w.branch !== "(bare)");
  const active = activeTasks(ctx.tasks);

  // 1. Declared overlaps between tasks (preflight: before any edit exists).
  for (const o of tasksOverlap(ctx.tasks)) {
    out.push({ level: "risk", code: "declared-overlap", message: `tasks ${o.a.id} and ${o.b.id} both claim ${o.on}`, tasks: [o.a.id, o.b.id], paths: [o.on], fix: "narrow one task's paths, or sequence the two tasks and merge the first before the second starts" });
  }

  // 2. The same path touched in two or more worktrees (uncommitted or committed since base).
  const byPath = new Map<string, WorktreeView[]>();
  for (const w of live) for (const p of touchedPaths(w)) byPath.set(p, [...(byPath.get(p) ?? []), w]);
  const collided = [...byPath.entries()].filter(([, ws]) => ws.length > 1);
  for (const [p, ws] of collided) {
    out.push({ level: "risk", code: "changed-path-overlap", message: `${p} is changed in ${ws.length} worktrees: ${ws.map(wtName).join(", ")}`, paths: [p], worktrees: ws.map((w) => w.path), fix: "merge one side first, then rebase the other onto it and re-run its tests before merging" });
  }

  // 3. Scope: a worktree on a task's branch touching paths outside the task, or inside another task.
  for (const w of live) {
    const mine = taskForWorktree(ctx.tasks, w);
    const touched = touchedPaths(w);
    if (mine !== undefined) {
      const outside = touched.filter((p) => !mine.paths.some((g) => globMatches(g, p)));
      if (outside.length) {
        out.push({ level: "warn", code: "outside-claim", message: `${wtName(w)} (task ${mine.id}) touched ${outside.length} path${outside.length === 1 ? "" : "s"} outside its claim`, tasks: [mine.id], paths: outside, worktrees: [w.path], fix: `widen task ${mine.id} with the paths it really needs, or move those changes to the task that owns them` });
      }
    }
    const foreign = new Map<string, string[]>();
    for (const p of touched) {
      const v = findViolation(ctx.tasks, p, w.branch);
      if (v !== undefined && v.id !== mine?.id) foreign.set(v.id, [...(foreign.get(v.id) ?? []), p]);
    }
    for (const [id, paths] of foreign) {
      out.push({ level: "risk", code: "owned-by-other-task", message: `${wtName(w)} changed ${paths.length} path${paths.length === 1 ? "" : "s"} owned by task ${id}`, tasks: [id], paths, worktrees: [w.path], fix: `coordinate with task ${id} before merging; its branch will conflict or be overwritten` });
    }
  }

  // 4. Hotspots: the same category of file touched by two or more worktrees, even under different names.
  const byCat = new Map<string, { w: WorktreeView; p: string; why: string }[]>();
  for (const w of live) for (const p of touchedPaths(w)) {
    const h = hotspotOf(p);
    if (h) byCat.set(h.category, [...(byCat.get(h.category) ?? []), { w, p, why: h.why }]);
  }
  for (const [cat, hits] of byCat) {
    const wts = [...new Set(hits.map((h) => h.w.path))];
    if (wts.length < 2) continue;
    const paths = [...new Set(hits.map((h) => h.p))];
    if (paths.length === 1 && collided.some(([p]) => p === paths[0])) continue; // already reported as a direct overlap
    out.push({ level: "warn", code: `hotspot-${cat}`, message: `${wts.length} worktrees touch ${cat} files: ${paths.slice(0, 3).join(", ")}${paths.length > 3 ? "…" : ""}`, paths, worktrees: wts, fix: hits[0]!.why });
  }

  // 5. Stale base and in-flight operations.
  for (const w of live) {
    if (w.behind > 0) out.push({ level: "warn", code: "behind-base", message: `${wtName(w)} is ${w.behind} commit${w.behind === 1 ? "" : "s"} behind ${ctx.base}`, worktrees: [w.path], fix: `rebase or merge ${ctx.base} into ${w.branch} yourself before handing off; conflicts found now are cheaper than at merge time` });
    for (const f of w.inFlight) out.push({ level: "risk", code: "in-flight", message: `${wtName(w)}: ${f}`, worktrees: [w.path], fix: "finish or abort that git operation before any session runs git here" });
    const conflicts = w.changes.filter((c) => c.kind === "conflict").map((c) => c.path);
    if (conflicts.length) out.push({ level: "risk", code: "unresolved-conflict", message: `${wtName(w)} has ${conflicts.length} unresolved conflict${conflicts.length === 1 ? "" : "s"}`, paths: conflicts, worktrees: [w.path], fix: "resolve and commit before handing off" });
  }

  // 6. Stale tasks: active but no branch or worktree carries them any more.
  for (const t of active) {
    if (t.branch === "") continue;
    if (!knownBranches.has(t.branch) && !live.some((w) => w.branch === t.branch)) {
      out.push({ level: "info", code: "stale-task", message: `task ${t.id} claims ${t.paths.join(", ")} on ${t.branch}, but that branch no longer exists`, tasks: [t.id], fix: `guardian task done --id ${t.id} if the work landed, or recreate the branch` });
    }
  }

  const order = { risk: 0, warn: 1, info: 2 } as const;
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

/** Least-entangled first: tasks sorted by how many findings name them. Advisory. */
export function suggestedOrder(tasks: readonly Task[], findings: readonly Finding[]): { id: string; score: number }[] {
  return activeTasks(tasks)
    .map((t) => ({ id: t.id, score: findings.filter((f) => f.tasks?.includes(t.id) || (f.worktrees && f.tasks === undefined && false)).length }))
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
}

/** Everything a command needs to know about the repository, gathered read-only. */
import { realpathSync } from "node:fs";
import path from "node:path";
import { aheadBehind, branch, changes, commitedSinceSafe, commonDir, detectBase, headSha, inFlight, isRepo, toplevel, worktreeGitDir, worktrees, type Change, type Worktree } from "./git.ts";
import { loadTasks, taskFilePath, type Task } from "./tasks.ts";

export type WorktreeView = Worktree & {
  isHere: boolean;
  changes: Change[];
  committed: string[];
  ahead: number;
  behind: number;
  inFlight: string[];
};

export type RepoContext = {
  cwd: string;
  root: string;
  gitCommon: string;
  branch: string;
  head: string;
  base: string;
  /** The main worktree's root: where .guardian/ (tasks, policy, hotspots) lives for every worktree. */
  mainRoot: string;
  tasksFile: string;
  tasks: Task[];
  worktrees: WorktreeView[];
};

export class NotARepo extends Error {}

/** Canonical form for comparing paths git prints (forward slashes) with paths Node resolves (backslashes on Windows). */
export const canon = (p: string) => {
  let r: string;
  try {
    r = realpathSync(p);
  } catch {
    r = path.resolve(p);
  }
  r = r.replace(/\\/g, "/");
  return process.platform === "win32" ? r.toLowerCase() : r;
};
const safeReal = canon;

export async function loadContext(cwd: string, baseOverride?: string): Promise<RepoContext> {
  if (!(await isRepo(cwd))) throw new NotARepo(`${cwd} is not inside a git repository`);
  const root = await toplevel(cwd);
  const gitCommon = await commonDir(cwd);
  const base = baseOverride ?? (await detectBase(root));
  const tasksFile = taskFilePath(gitCommon);
  const list = await worktrees(root);
  const views: WorktreeView[] = [];
  for (const w of list) {
    if (w.prunable || w.branch === "(bare)") {
      views.push({ ...w, isHere: false, changes: [], committed: [], ahead: 0, behind: 0, inFlight: [] });
      continue;
    }
    const ab = await aheadBehind(base, w.path);
    views.push({
      ...w,
      isHere: safeReal(w.path) === safeReal(root),
      changes: await changes(w.path),
      committed: await commitedSinceSafe(base, w.path),
      ahead: ab.ahead,
      behind: ab.behind,
      inFlight: inFlight(gitCommon, await worktreeGitDir(w.path)),
    });
  }
  return { cwd, root, gitCommon, mainRoot: path.dirname(path.dirname(tasksFile)), branch: await branch(root), head: await headSha(root), base, tasksFile, tasks: loadTasks(tasksFile), worktrees: views };
}

/** All paths a worktree touches: uncommitted (new path of a rename) plus committed since base. */
export function touchedPaths(w: WorktreeView): string[] {
  return [...new Set([...w.changes.map((c) => c.path), ...w.committed])].sort();
}

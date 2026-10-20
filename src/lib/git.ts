/**
 * Read-only Git access. Every call is argv-based (no shell), so no path or ref can inject a command.
 * Nothing here checks out, merges, rebases, resets, pushes, or deletes.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export type GitResult = { ok: boolean; stdout: string; stderr: string };

export function git(args: readonly string[], cwd: string): Promise<GitResult> {
  return new Promise((resolve) => {
    execFile("git", [...args], { cwd, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

const out = async (args: readonly string[], cwd: string): Promise<string> => {
  const r = await git(args, cwd);
  return r.ok ? r.stdout.trim() : "";
};

export async function isRepo(cwd: string): Promise<boolean> {
  return (await git(["rev-parse", "--git-dir"], cwd)).ok;
}

/** Absolute path of the worktree root that contains `cwd`. */
export const toplevel = (cwd: string) => out(["rev-parse", "--show-toplevel"], cwd);
/** Absolute `.git` of the main worktree, shared by all linked worktrees. */
export const commonDir = (cwd: string) => out(["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd);
/** Branch name, or `(detached)`, or `(unborn)` on a repo with no commits. */
export async function branch(cwd: string): Promise<string> {
  const b = await out(["symbolic-ref", "--short", "-q", "HEAD"], cwd);
  if (b !== "") return b;
  return (await out(["rev-parse", "--verify", "-q", "HEAD"], cwd)) === "" ? "(unborn)" : "(detached)";
}
export const headSha = (cwd: string) => out(["rev-parse", "--short", "HEAD"], cwd);

export type Worktree = { path: string; branch: string; head: string; locked: string | null; prunable: boolean };

export async function worktrees(cwd: string): Promise<Worktree[]> {
  const raw = await out(["worktree", "list", "--porcelain"], cwd);
  if (raw === "") return [];
  return raw.split(/\n\n+/).flatMap((block) => {
    const p = /^worktree (.+)$/m.exec(block)?.[1];
    if (p === undefined) return [];
    const ref = /^branch refs\/heads\/(.+)$/m.exec(block)?.[1];
    const lockLine = /^locked(?: (.*))?$/m.exec(block);
    return [{
      path: p,
      branch: ref ?? (/^detached$/m.test(block) ? "(detached)" : "(bare)"),
      head: /^HEAD ([0-9a-f]+)$/m.exec(block)?.[1]?.slice(0, 7) ?? "",
      locked: lockLine ? (lockLine[1] ?? "") : null,
      prunable: /^prunable/m.test(block),
    }];
  });
}

export type Change = { path: string; kind: "modified" | "added" | "deleted" | "renamed" | "untracked" | "conflict" | "other"; from?: string };

/** Working-tree changes versus HEAD, untracked files included, renames resolved, NUL-safe for odd names. */
export async function changes(cwd: string): Promise<Change[]> {
  const r = await git(["status", "--porcelain=v1", "-z", "--untracked-files=all"], cwd);
  if (!r.ok) return [];
  const parts = r.stdout.split("\0");
  const list: Change[] = [];
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i];
    if (entry === undefined || entry.length < 4) continue;
    const xy = entry.slice(0, 2);
    const p = entry.slice(3);
    if (xy === "??") list.push({ path: p, kind: "untracked" });
    else if (xy.includes("U") || xy === "AA" || xy === "DD") list.push({ path: p, kind: "conflict" });
    else if (xy.includes("R") || xy.includes("C")) {
      const from = parts[++i] ?? "";
      list.push({ path: p, kind: "renamed", from });
    } else if (xy.includes("D")) list.push({ path: p, kind: "deleted" });
    else if (xy.includes("A")) list.push({ path: p, kind: "added" });
    else if (xy.includes("M") || xy.includes("T")) list.push({ path: p, kind: "modified" });
    else list.push({ path: p, kind: "other" });
  }
  return list;
}

/** Paths changed by commits on HEAD since it diverged from `base` (empty when base is unknown). */
export async function committedSince(base: string, cwd: string): Promise<string[]> {
  if (base === "") return [];
  const r = await git(["diff", "--name-only", "-z", `${base}...HEAD`], cwd);
  return r.ok ? r.stdout.split("\0").filter((p) => p !== "") : [];
}

/** committedSince, but "" base or an unrelated base yields []. */
export async function commitedSinceSafe(base: string, cwd: string): Promise<string[]> {
  try {
    return await committedSince(base, cwd);
  } catch {
    return [];
  }
}

/** The integration base: origin's default branch if known, else main/master, else "". */
export async function detectBase(cwd: string): Promise<string> {
  const head = await out(["symbolic-ref", "--short", "-q", "refs/remotes/origin/HEAD"], cwd);
  if (head !== "") return head;
  for (const ref of ["origin/main", "origin/master", "main", "master"]) {
    if ((await git(["rev-parse", "--verify", "-q", ref], cwd)).ok) return ref;
  }
  return "";
}

export async function aheadBehind(base: string, cwd: string): Promise<{ ahead: number; behind: number }> {
  if (base === "") return { ahead: 0, behind: 0 };
  const counts = await out(["rev-list", "--left-right", "--count", `${base}...HEAD`], cwd);
  const [behind = 0, ahead = 0] = counts === "" ? [] : counts.split(/\s+/).map(Number);
  return { ahead, behind };
}

export async function refExists(ref: string, cwd: string): Promise<boolean> {
  return (await git(["rev-parse", "--verify", "-q", `refs/heads/${ref}`], cwd)).ok;
}

/** Git operations in flight: a lock or a merge / rebase / cherry-pick state. */
export function inFlight(gitDir: string, worktreeGitDir: string): string[] {
  const found: string[] = [];
  if (existsSync(path.join(gitDir, "index.lock")) || existsSync(path.join(worktreeGitDir, "index.lock"))) found.push("index.lock");
  for (const f of ["MERGE_HEAD", "REBASE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "BISECT_LOG"]) {
    if (existsSync(path.join(worktreeGitDir, f)) || existsSync(path.join(gitDir, f))) found.push(f);
  }
  if (existsSync(path.join(worktreeGitDir, "rebase-merge")) || existsSync(path.join(worktreeGitDir, "rebase-apply"))) found.push("rebase in progress");
  return found;
}

/** The per-worktree git dir (`.git` for the main worktree, `.git/worktrees/<name>` for linked ones). */
export const worktreeGitDir = (cwd: string) => out(["rev-parse", "--path-format=absolute", "--git-dir"], cwd);

/** A fingerprint of the working tree's content: changes when any tracked or untracked file changes. */
export async function treeFingerprint(cwd: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  const h = createHash("sha256");
  h.update(await out(["rev-parse", "HEAD"], cwd));
  h.update("\0");
  const status = await git(["status", "--porcelain=v1", "-z", "--untracked-files=all"], cwd);
  h.update(status.stdout);
  h.update("\0");
  const diff = await git(["diff", "HEAD", "--no-color", "--no-ext-diff"], cwd);
  h.update(diff.stdout);
  return h.digest("hex").slice(0, 16);
}

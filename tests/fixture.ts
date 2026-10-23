/** Builds throwaway git repositories with worktrees for the CLI tests. */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/index.ts");

const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };

export const sh = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, env: GIT_ENV, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();

export function write(root: string, rel: string, text: string) {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  writeFileSync(path.join(root, rel), text);
}

export function guardian(cwd: string, ...args: string[]) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1", GUARDIAN_HOME: process.env.GUARDIAN_HOME ?? "/nonexistent-guardian-home", GUARDIAN_NO_USAGE: process.env.GUARDIAN_NO_USAGE ?? "1" } });
  return { code: r.status ?? -1, out: r.stdout, err: r.stderr, json: () => JSON.parse(r.stdout) as any };
}

/** main with one commit, plus worktrees on feature/auth and feature/api branched from it. */
export function repoWithWorktrees() {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "guardian-"))); // git reports real paths (/private/var on macOS)
  const main = path.join(dir, "main");
  mkdirSync(main);
  sh(main, "init", "-q", "-b", "main");
  write(main, "src/auth/a.ts", "export const a = 1\n");
  write(main, "src/api/b.ts", "export const b = 1\n");
  write(main, "docs/x.md", "# x\n");
  write(main, "package-lock.json", "{}\n");
  sh(main, "add", "-A");
  sh(main, "commit", "-q", "-m", "init");
  const auth = path.join(dir, "wt-auth");
  const api = path.join(dir, "wt-api");
  sh(main, "worktree", "add", "-q", "-b", "feature/auth", auth);
  sh(main, "worktree", "add", "-q", "-b", "feature/api", api);
  return { dir, main, auth, api };
}

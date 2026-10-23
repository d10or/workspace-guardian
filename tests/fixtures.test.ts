/** Edge-case fixtures toward the plan's 20-fixture target (symlinks, deletions, detached HEAD, unborn repos, odd names). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { guardian, repoWithWorktrees, sh, write } from "./fixture.ts";

const codes = (cwd: string, ...extra: string[]) => guardian(cwd, "check", "--json", ...extra).json().findings.map((f: any) => f.code) as string[];

test("fixture: symlink and deleted file count as changes, symlink target is not followed", { skip: process.platform === "win32" ? "symlinks need a privilege on Windows" : false }, () => {
  const { main, auth } = repoWithWorktrees();
  guardian(main, "task", "add", "--id", "AUTH", "--paths", "src/auth/**", "--branch", "feature/auth", "--yes");
  symlinkSync("../../docs/x.md", path.join(auth, "src/auth/link.md"));
  unlinkSync(path.join(auth, "src/auth/a.ts"));
  const h = guardian(auth, "handoff", "--task", "AUTH", "--json").json();
  assert.ok(h.uncommitted.some((u: any) => u.path === "src/auth/link.md" && u.kind === "untracked"));
  assert.ok(h.uncommitted.some((u: any) => u.path === "src/auth/a.ts" && u.kind === "deleted"));
  assert.deepEqual(h.outsideClaim, [], "a symlink inside the claim is inside the claim");
  assert.ok(!codes(auth).includes("owned-by-other-task"));
});

test("fixture: a detached-HEAD worktree is inspected but never matched to a task", () => {
  const { main, dir } = repoWithWorktrees();
  const det = `${dir}/wt-detached`;
  sh(main, "worktree", "add", "-q", "--detach", det);
  write(det, "src/auth/a.ts", "detached edit\n");
  guardian(main, "task", "add", "--id", "AUTH", "--paths", "src/auth/**", "--branch", "feature/auth", "--yes");
  const ins = guardian(main, "inspect", "--json").json();
  assert.ok(ins.worktrees.some((w: any) => w.branch === "(detached)" && w.uncommitted === 1));
  const f = guardian(main, "check", "--json").json().findings.find((x: any) => x.code === "owned-by-other-task");
  assert.ok(f, "detached worktree editing AUTH's file is reported");
  assert.equal(f.worktrees[0], det);
});

test("fixture: unborn repository (no commits) still inspects and checks", () => {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "guardian-unborn-")));
  sh(dir, "init", "-q", "-b", "main");
  const ins = guardian(dir, "inspect", "--json");
  assert.equal(ins.code, 0);
  assert.equal(ins.json().branch, "main"); // git knows the branch name before the first commit
  assert.equal(ins.json().head, "");
  assert.equal(guardian(dir, "check").code, 0);
});

test("fixture: --base override and committed-since-base paths", () => {
  const { main, auth } = repoWithWorktrees();
  guardian(main, "task", "add", "--id", "AUTH", "--paths", "src/auth/**", "--branch", "feature/auth", "--yes");
  write(auth, "src/auth/new.ts", "1\n");
  write(auth, "src/api/leak.ts", "1\n");
  sh(auth, "add", "-A");
  sh(auth, "commit", "-q", "-m", "auth work");
  const h = guardian(auth, "handoff", "--task", "AUTH", "--json").json();
  assert.deepEqual(h.uncommitted, []);
  assert.ok(h.changedPaths.includes("src/auth/new.ts"), "committed paths count");
  assert.deepEqual(h.outsideClaim, ["src/api/leak.ts"]);
  assert.equal(h.commits.length, 1);
  // with the base set to the branch itself, nothing is "since base"
  const h2 = guardian(auth, "handoff", "--task", "AUTH", "--json", "--base", "feature/auth").json();
  assert.deepEqual(h2.changedPaths, []);
  assert.equal(guardian(auth, "inspect", "--json", "--base", "feature/auth").json().base, "feature/auth");
});

test("fixture: a task without a branch is informational and never produces an ownership finding", () => {
  const { main, api } = repoWithWorktrees();
  guardian(main, "task", "add", "--id", "DOCS", "--paths", "docs/**", "--branch", "", "--yes");
  write(api, "docs/x.md", "api edits docs\n");
  assert.ok(!codes(api).includes("owned-by-other-task"));
  assert.equal(guardian(main, "task", "list", "--json").json().tasks[0].branch, "");
});

test("fixture: Claude Code's native worktree location (.claude/worktrees/<name>) is seen like any other", () => {
  const { main } = repoWithWorktrees();
  const native = path.join(main, ".claude", "worktrees", "feat-x");
  mkdirSync(path.dirname(native), { recursive: true });
  sh(main, "worktree", "add", "-q", "-b", "feat-x", native);
  write(native, "src/auth/a.ts", "x\n");
  guardian(main, "task", "add", "--id", "AUTH", "--paths", "src/auth/**", "--branch", "feature/auth", "--yes");
  const ins = guardian(main, "inspect", "--json").json();
  assert.ok(ins.worktrees.some((w: any) => w.branch === "feat-x"));
  assert.ok(codes(main).includes("owned-by-other-task"));
});

test("fixture: unicode and quoted path names survive the NUL-separated status parse", () => {
  const { main, auth } = repoWithWorktrees();
  guardian(main, "task", "add", "--id", "AUTH", "--paths", "src/auth/**", "--branch", "feature/auth", "--yes");
  const name = process.platform === "win32" ? "src/auth/héllo wörld.ts" : 'src/auth/héllo wörld "q".ts'; // quotes are illegal in Windows names
  write(auth, name, "1\n");
  const h = guardian(auth, "handoff", "--task", "AUTH", "--json").json();
  assert.ok(h.changedPaths.includes(name));
});

test("fixture: handoff --evidence is marked supplied, not verified; --out writes JSON with --json", () => {
  const { main, auth, dir } = repoWithWorktrees();
  guardian(main, "task", "add", "--id", "AUTH", "--paths", "src/auth/**", "--branch", "feature/auth", "--yes");
  const log = path.join(dir, "test.log");
  writeFileSync(log, "ok\n12 passed\n");
  const h = guardian(auth, "handoff", "--task", "AUTH", "--evidence", log, "--json").json();
  assert.equal(h.tests.status, "supplied");
  assert.match(h.tests.note, /did not run it/);
  const out = path.join(dir, "h.json");
  assert.equal(guardian(auth, "handoff", "--task", "AUTH", "--evidence", log, "--json", "--out", out).code, 0);
  assert.equal(JSON.parse(readFileSync(out, "utf8")).tests.status, "supplied");
});

test("fixture: inspect human output lists worktrees and the task map", () => {
  const { main, auth } = repoWithWorktrees();
  guardian(main, "task", "add", "--id", "AUTH", "--paths", "src/auth/**", "--branch", "feature/auth", "--yes");
  const r = guardian(main, "inspect");
  assert.equal(r.code, 0);
  assert.match(r.out, /feature\/auth/);
  assert.match(r.out, new RegExp(`AUTH.*→ ${auth.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.match(r.out, /▸ main/);
});

test("fixture: an unresolved merge conflict is a risk and in-flight state is reported", () => {
  const { main, auth } = repoWithWorktrees();
  write(auth, "src/auth/a.ts", "auth version\n");
  sh(auth, "commit", "-q", "-am", "auth");
  write(main, "src/auth/a.ts", "main version\n");
  sh(main, "commit", "-q", "-am", "main");
  try {
    sh(auth, "merge", "main");
  } catch {
    // conflict expected
  }
  const f = guardian(auth, "check", "--json").json().findings;
  assert.ok(f.some((x: any) => x.code === "unresolved-conflict" && x.paths[0] === "src/auth/a.ts"));
  assert.ok(f.some((x: any) => x.code === "in-flight" && /MERGE_HEAD/.test(x.message)));
});

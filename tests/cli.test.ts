import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { guardian, repoWithWorktrees, sh, write } from "./fixture.ts";

test("help and unknown command", () => {
  assert.equal(guardian(process.cwd(), "--help").code, 0);
  assert.match(guardian(process.cwd(), "--help").out, /Usage:/);
  assert.equal(guardian(process.cwd(), "nope").code, 2);
});

test("outside a repository every command fails cleanly", async () => {
  const { tmpdir } = await import("node:os");
  const r = guardian(tmpdir(), "inspect");
  assert.equal(r.code, 1);
  assert.match(r.err, /not inside a git repository/);
});

test("end to end: declare tasks, inspect, check, handoff on two worktrees", async () => {
  const { main, auth, api, dir } = repoWithWorktrees();
  const tasksFile = path.join(main, ".guardian", "tasks.json");

  // --- task add needs confirmation unless --yes; non-TTY without --yes refuses and writes nothing
  const refused = guardian(main, "task", "add", "--id", "AUTH", "--paths", "src/auth/**", "--branch", "feature/auth");
  assert.equal(refused.code, 1);
  assert.equal(existsSync(tasksFile), false);

  assert.equal(guardian(main, "task", "add", "--id", "AUTH", "--paths", "src/auth/**", "--branch", "feature/auth", "--note", "login", "--yes").code, 0);
  // declared from inside a worktree, the file still lands beside the main worktree
  const api2 = guardian(api, "task", "add", "--id", "API", "--paths", "src/api/**,./docs/", "--yes", "--json");
  assert.equal(api2.code, 0);
  assert.equal(api2.json().task.branch, "feature/api");
  assert.deepEqual(api2.json().task.paths, ["src/api/**", "docs"]);
  assert.equal(existsSync(tasksFile), true);
  assert.equal(guardian(main, "task", "add", "--id", "AUTH", "--paths", "x", "--yes").code, 1, "duplicate active id is refused");

  const list = guardian(auth, "task", "list", "--json").json();
  assert.deepEqual(list.tasks.map((t: any) => t.id), ["AUTH", "API"]);
  assert.deepEqual(list.overlaps, []);

  // --- inspect maps tasks to the worktree carrying their branch
  const ins = guardian(main, "inspect", "--json").json();
  assert.equal(ins.schemaVersion, 1);
  assert.equal(ins.worktrees.length, 3);
  assert.equal(ins.base, "main");
  assert.equal(ins.tasks.find((t: any) => t.id === "AUTH").worktree, auth);
  assert.equal(ins.tasks.find((t: any) => t.id === "API").worktree, api);

  // --- clean state: no risks
  const clean = guardian(main, "check", "--json").json();
  assert.deepEqual(clean.findings.filter((f: any) => f.level === "risk"), []);
  assert.equal(guardian(main, "check", "--strict").code, 0);

  // --- now make trouble
  write(auth, "src/auth/a.ts", "export const a = 2\n"); // AUTH edits its own file
  write(api, "src/auth/a.ts", "export const a = 3\n"); // API edits AUTH's file: same path, other task
  write(auth, "docs/x.md", "# changed by auth\n"); // outside AUTH's claim (and owned by API)
  write(auth, "src/auth/with space.ts", "export const s = 1\n"); // untracked, odd name
  write(auth, "package-lock.json", "{\"a\":1}\n"); // hotspot in auth
  write(api, "yarn.lock", "# lock\n"); // different lockfile in api → same hotspot category
  sh(api, "mv", "src/api/b.ts", "src/api/c.ts"); // rename, staged
  write(main, "README.md", "# moved on\n"); // main advances → both worktrees behind base
  sh(main, "add", "README.md");
  sh(main, "commit", "-q", "-m", "main moves");
  // a task on a branch that no longer exists
  assert.equal(guardian(main, "task", "add", "--id", "OLD", "--paths", "zz/**", "--branch", "gone", "--yes").code, 0);
  // a declared overlap
  assert.equal(guardian(main, "task", "add", "--id", "AUTH2", "--paths", "src/auth/session.ts", "--branch", "feature/auth2", "--yes").code, 0);

  const chk = guardian(auth, "check", "--json").json();
  const codes = (code: string) => chk.findings.filter((f: any) => f.code === code);
  assert.equal(codes("declared-overlap").length, 1, "AUTH vs AUTH2");
  assert.deepEqual(codes("declared-overlap")[0].tasks, ["AUTH", "AUTH2"]);
  const overlap = codes("changed-path-overlap");
  assert.equal(overlap.length, 1, "src/auth/a.ts in two worktrees");
  assert.deepEqual(overlap[0].paths, ["src/auth/a.ts"]);
  const owned = codes("owned-by-other-task");
  assert.ok(owned.some((f: any) => f.tasks[0] === "AUTH" && f.worktrees[0] === api), "api touched AUTH's file");
  assert.ok(owned.some((f: any) => f.tasks[0] === "API" && f.worktrees[0] === auth), "auth touched API's docs");
  const outside = codes("outside-claim").find((f: any) => f.tasks[0] === "AUTH");
  assert.ok(outside, "auth touched outside its claim");
  assert.deepEqual(outside.paths, ["docs/x.md", "package-lock.json"]);
  assert.equal(codes("hotspot-lockfile").length, 1, "two different lockfiles, one category");
  assert.equal(codes("behind-base").length, 2, "both worktrees behind main");
  assert.equal(codes("stale-task").length, 2, "OLD and AUTH2 both name branches that do not exist");
  assert.ok(codes("stale-task").some((f: any) => f.tasks[0] === "OLD"));
  assert.ok(chk.suggestedOrder.length >= 3);
  assert.equal(guardian(auth, "check", "--strict").code, 3);
  const human = guardian(auth, "check");
  assert.equal(human.code, 0);
  assert.match(human.out, /\[risk\] src\/auth\/a\.ts is changed in 2 worktrees/);
  assert.match(human.out, /suggested merge order/);

  // --- in-flight: an index.lock in the api worktree
  write(path.join(main, ".git", "worktrees", "wt-api"), "index.lock", "");
  assert.ok(guardian(main, "check", "--json").json().findings.some((f: any) => f.code === "in-flight" && f.worktrees[0] === api));
  sh(main, "worktree", "prune"); // no-op, keeps the fixture honest
  const { rmSync } = await import("node:fs");
  rmSync(path.join(main, ".git", "worktrees", "wt-api", "index.lock"));

  // --- handoff: never claims tests passed without evidence
  const h = guardian(auth, "handoff", "--task", "AUTH", "--json").json();
  assert.equal(h.tests.status, "not verified");
  assert.equal(h.branch, "feature/auth");
  assert.equal(h.behind, 1);
  assert.ok(h.changedPaths.includes("src/auth/a.ts"));
  assert.ok(h.changedPaths.includes("src/auth/with space.ts"), "path with a space survives");
  assert.deepEqual(h.outsideClaim, ["docs/x.md", "package-lock.json"]);
  assert.ok(h.openRisks.some((f: any) => f.code === "changed-path-overlap"));
  assert.ok(h.nextSteps.some((s: string) => /run the test suite/.test(s)));
  // the api worktree's rename shows under its new name
  const hApi = guardian(api, "handoff", "--task", "API", "--json").json();
  assert.ok(hApi.changedPaths.includes("src/api/c.ts"));
  assert.ok(hApi.uncommitted.some((u: any) => u.path === "src/api/c.ts" && u.kind === "renamed"));

  const ok = guardian(auth, "handoff", "--task", "AUTH", "--run", `${process.execPath} -e process.exit(0)`, "--json").json();
  assert.equal(ok.tests.status, "verified");
  assert.equal(ok.tests.exitCode, 0);
  assert.match(ok.tests.fingerprint, /^[0-9a-f]{16}$/);
  const bad = guardian(auth, "handoff", "--task", "AUTH", "--run", `${process.execPath} -e process.exit(3)`, "--json").json();
  assert.equal(bad.tests.status, "failed");
  assert.equal(bad.tests.exitCode, 3);
  assert.ok(bad.nextSteps.some((s: string) => /exit 3/.test(s)));

  const out = path.join(dir, "reports", "AUTH.md");
  assert.equal(guardian(auth, "handoff", "--task", "AUTH", "--out", out).code, 0);
  const md = readFileSync(out, "utf8");
  assert.match(md, /^# Handoff: AUTH/);
  assert.match(md, /\*\*not verified\*\*/);
  assert.match(md, /`src\/auth\/a\.ts`/);
  assert.match(md, /guardian never merges/);

  // --- inspect, check and handoff never modified tracked files; the only write is .guardian/
  assert.deepEqual(sh(main, "status", "--porcelain").split("\n").filter((l) => l && !l.includes(".guardian/")), []);
  assert.equal(guardian(main, "task", "done", "--id", "OLD").code, 0);
  assert.ok(!guardian(main, "check", "--json").json().findings.some((f: any) => f.code === "stale-task" && f.tasks[0] === "OLD"));
});

test("task add refuses a bad id and empty paths without touching the repo", () => {
  const { main } = repoWithWorktrees();
  assert.equal(guardian(main, "task", "add", "--id", "bad id", "--paths", "x", "--yes").code, 2);
  assert.equal(guardian(main, "task", "add", "--id", "ok", "--paths", " , ", "--yes").code, 2);
  assert.equal(existsSync(path.join(main, ".guardian")), false);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { findViolation, globMatches, parseTasks, serializeTasks, taskFilePath, tasksOverlap, type Task } from "../src/lib/tasks.ts";
import { hotspotOf } from "../src/lib/hotspots.ts";

const row = (over: Partial<Task>): Task => ({ id: "T", paths: ["src/**"], branch: "feat", owner: "", note: "", createdAt: 0, status: "active", ...over });

test("globMatches: ** matches zero directories, * stays in one segment", () => {
  assert.equal(globMatches("src/**/x.ts", "src/x.ts"), true);
  assert.equal(globMatches("src/**/x.ts", "src/a/b/x.ts"), true);
  assert.equal(globMatches("src/*", "src/a/b.ts"), false);
  assert.equal(globMatches("src/auth", "src/auth/session.ts"), true);
  assert.equal(globMatches("src/auth", "src/authz/x.ts"), false);
  assert.equal(globMatches("src/with space/**", "src/with space/a b.ts"), true);
  assert.equal(globMatches("", "x"), false);
});

test("taskFilePath is shared by all worktrees", () => {
  assert.equal(taskFilePath("/repo/.git"), "/repo/.guardian/tasks.json");
  assert.equal(taskFilePath("/repo/.git/"), "/repo/.guardian/tasks.json");
});

test("parseTasks round-trips and drops junk", () => {
  assert.deepEqual(parseTasks("nope"), []);
  const list = [row({ id: "A", note: "n" }), row({ id: "B", status: "done" })];
  assert.deepEqual(parseTasks(serializeTasks(list)), list);
  assert.deepEqual(parseTasks('{"tasks":[{"id":"","paths":["a"]},{"id":"ok","paths":[" a ",3]}]}'), [row({ id: "ok", paths: ["a"], branch: "" })]);
});

test("findViolation and tasksOverlap follow the mod's rules", () => {
  const tasks = [row({ id: "AUTH", paths: ["src/auth/**"], branch: "feature/auth" }), row({ id: "FREE", paths: ["docs/**"], branch: "" }), row({ id: "B", paths: ["src/auth/session.ts"], branch: "x" })];
  assert.equal(findViolation(tasks, "src/auth/session.ts", "main")?.id, "AUTH");
  assert.equal(findViolation(tasks, "src/auth/session.ts", "feature/auth")?.id, "B");
  assert.equal(findViolation(tasks, "docs/a.md", "main"), undefined);
  const hits = tasksOverlap(tasks);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.on, "src/auth/**");
});

test("hotspots classify lockfiles, migrations, schemas", () => {
  assert.equal(hotspotOf("package-lock.json")?.category, "lockfile");
  assert.equal(hotspotOf("apps/web/yarn.lock")?.category, "lockfile");
  assert.equal(hotspotOf("db/migrations/0003_add.sql")?.category, "migration");
  assert.equal(hotspotOf("prisma/schema.prisma")?.category, "schema");
  assert.equal(hotspotOf("src/auth/a.ts"), undefined);
});

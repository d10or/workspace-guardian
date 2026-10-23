import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { guardian, repoWithWorktrees } from "./fixture.ts";

const withHome = (fn: (home: string) => void) => {
  const home = mkdtempSync(path.join(tmpdir(), "guardian-usage-"));
  const prev = { h: process.env.GUARDIAN_HOME, n: process.env.GUARDIAN_NO_USAGE };
  process.env.GUARDIAN_HOME = home;
  process.env.GUARDIAN_NO_USAGE = "0";
  try {
    fn(home);
  } finally {
    process.env.GUARDIAN_HOME = prev.h;
    process.env.GUARDIAN_NO_USAGE = prev.n;
  }
};

test("usage: commands record counts only, never paths; summary reports activation and repeat", () => {
  withHome((home) => {
    const { main, auth } = repoWithWorktrees();
    assert.equal(guardian(main, "usage").code, 0);
    assert.match(guardian(main, "usage").out, /nothing recorded yet/);
    guardian(main, "task", "add", "--id", "AUTH", "--paths", "src/auth/**", "--branch", "feature/auth", "--yes");
    guardian(auth, "inspect");
    guardian(auth, "check");
    guardian(auth, "handoff", "--task", "AUTH", "--run", `${process.execPath} -e process.exit(0)`);
    const file = path.join(home, "usage", "cli.json");
    assert.ok(existsSync(file));
    const raw = readFileSync(file, "utf8");
    assert.doesNotMatch(raw, /src\/auth|AUTH|feature\/auth|wt-auth/, "no path, id or branch may be recorded");
    const s = guardian(main, "usage", "--json").json();
    assert.equal(s.totals.task_add, 1);
    assert.equal(s.totals.inspect, 1);
    assert.equal(s.totals.check, 1);
    assert.equal(s.totals.handoff, 1);
    assert.equal(s.totals.handoff_verified, 1);
    assert.equal(s.activated, true);
    assert.equal(s.repeat, false, "one day only");
    assert.match(s.installId, /^[0-9a-f]{12}$/);
    // a mod file from another day merges in and makes it repeat use
    writeFileSync(path.join(home, "usage", "mod-abc.json"), JSON.stringify({ v: 1, installId: s.installId, firstSeen: "2026-10-01", days: { "2026-10-01": { session_start: 2, check: 1 } } }));
    const s2 = guardian(main, "usage", "--json").json();
    assert.equal(s2.activeDays, 2);
    assert.equal(s2.repeat, true);
    assert.equal(s2.totals.session_start, 2);
    assert.equal(s2.firstSeen, "2026-10-01");
    assert.equal(guardian(main, "usage", "--reset").code, 0);
    assert.equal(existsSync(path.join(home, "usage")), false);
  });
});

test("usage: GUARDIAN_NO_USAGE=1 records nothing", () => {
  withHome((home) => {
    process.env.GUARDIAN_NO_USAGE = "1";
    const { main } = repoWithWorktrees();
    guardian(main, "inspect");
    assert.equal(existsSync(path.join(home, "usage")), false);
  });
});

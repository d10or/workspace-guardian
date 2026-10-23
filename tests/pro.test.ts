/** Pro loading in the free core: keys verify offline, the loader degrades to free behaviour, and a Pro module shapes check. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { verifyKey } from "../src/lib/license.ts";
import { guardian, repoWithWorktrees, write } from "./fixture.ts";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PUB = publicKey.export({ type: "spki", format: "pem" }) as string;
const makeKey = (over: Record<string, unknown> = {}) => {
  const payload = Buffer.from(JSON.stringify({ v: 1, id: "ORDER-1", email_hash: "abcd", tier: "pro", issued: "2026-10-23", expires: null, seats: 1, ...over }));
  return `WG1.${payload.toString("base64url")}.${sign(null, payload, privateKey).toString("base64url")}`;
};

const withEnv = (vars: Record<string, string>, fn: () => void) => {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
};

test("verifyKey: valid, expired, tampered, foreign, garbage", () => {
  withEnv({ GUARDIAN_PUBKEY_PEM: PUB }, () => {
    assert.equal(verifyKey(makeKey()).status, "valid");
    assert.equal(verifyKey(makeKey({ expires: "2020-01-01" })).status, "expired");
    const k = makeKey();
    const tampered = k.slice(0, 10) + (k[10] === "A" ? "B" : "A") + k.slice(11);
    assert.equal(verifyKey(tampered).status, "invalid");
    assert.equal(verifyKey("WG1.abc").status, "invalid");
    assert.equal(verifyKey("").status, "invalid");
  });
  // the embedded production key must reject a key signed by this test's keypair
  assert.equal(verifyKey(makeKey()).status, "invalid");
});

test("license add/show/remove and a Pro module shaping check", () => {
  const home = mkdtempSync(path.join(tmpdir(), "guardian-pro-home-"));
  const proDir = mkdtempSync(path.join(tmpdir(), "guardian-pro-mod-"));
  const proFile = path.join(proDir, "index.js");
  writeFileSync(proFile, `
    export const version = "test-pro";
    export function loadPolicy(root) { try { return JSON.parse(require("node:fs").readFileSync(root + "/.guardian/policy.json", "utf8")); } catch { return null; } }
    export function applyPolicy(findings, policy) {
      const ignore = policy?.ignore ?? [];
      return { findings: findings.filter(f => !ignore.includes(f.code)), failOn: policy?.failOn ?? ["changed-path-overlap"] };
    }
    export function mergePlan(input) { return { order: input.tasks.map(t => ({ id: t.id, branch: t.branch, score: 0, reasons: [] })), steps: ["step one from test pro"] }; }
    export function hotspots() { return [{ category: "ledger", patterns: ["data/ledger.json"], why: "shared ids" }]; }
  `.replace('require("node:fs")', 'await import("node:fs")'));
  // the module above uses top-level await-free dynamic import; simplify: use fs via createRequire
  writeFileSync(proFile, `
    import { readFileSync } from "node:fs";
    export const version = "test-pro";
    export function loadPolicy(root) { try { return JSON.parse(readFileSync(root + "/.guardian/policy.json", "utf8")); } catch { return null; } }
    export function applyPolicy(findings, policy) {
      const ignore = policy?.ignore ?? [];
      return { findings: findings.filter(f => !ignore.includes(f.code)), failOn: policy?.failOn ?? ["changed-path-overlap"] };
    }
    export function mergePlan(input) { return { order: input.tasks.map(t => ({ id: t.id, branch: t.branch, score: 0, reasons: [] })), steps: ["step one from test pro"] }; }
    export function hotspots() { return [{ category: "ledger", patterns: ["data/ledger.json"], why: "shared ids" }]; }
  `);
  withEnv({ GUARDIAN_HOME: home, GUARDIAN_PUBKEY_PEM: PUB, GUARDIAN_PRO_PATH: proFile }, () => {
    const { main, auth, api } = repoWithWorktrees();
    assert.equal(guardian(main, "license", "show").code, 0);
    assert.match(guardian(main, "license", "show").out, /no Pro key/);
    assert.equal(guardian(main, "license", "add", "WG1.garbage.garbage").code, 1);
    assert.equal(guardian(main, "license", "add", makeKey()).code, 0);
    const show = guardian(main, "license", "show", "--json").json();
    assert.equal(show.status, "valid");
    assert.equal(show.id, "ORDER-1");

    guardian(main, "task", "add", "--id", "AUTH", "--paths", "src/auth/**", "--branch", "feature/auth", "--yes");
    guardian(main, "task", "add", "--id", "API", "--paths", "src/api/**", "--branch", "feature/api", "--yes");
    write(auth, "src/auth/a.ts", "1\n");
    write(api, "src/auth/a.ts", "2\n");
    write(auth, "data/ledger.json", "{}\n");
    write(api, "data/ledger.json", "{}\n");
    const chk = guardian(auth, "check", "--json").json();
    assert.equal(chk.pro.version, "test-pro");
    assert.equal(chk.pro.plan.steps[0], "step one from test pro");
    assert.ok(chk.findings.some((f: any) => f.code === "changed-path-overlap"));
    assert.ok(chk.findings.some((f: any) => f.code === "behind-base") === false, "no base movement in this fixture");
    assert.match(guardian(auth, "check").out, /merge plan \(Pro test-pro\)/);
    assert.equal(guardian(auth, "check", "--strict").code, 3, "fails on changed-path-overlap per default failOn");

    // a policy that ignores the overlap and fails on nothing present makes strict pass
    mkdirSync(path.join(main, ".guardian"), { recursive: true });
    writeFileSync(path.join(main, ".guardian", "policy.json"), JSON.stringify({ ignore: ["changed-path-overlap", "owned-by-other-task"], failOn: ["in-flight"] }));
    const chk2 = guardian(auth, "check", "--json").json();
    assert.ok(!chk2.findings.some((f: any) => f.code === "changed-path-overlap"));
    assert.equal(guardian(auth, "check", "--strict").code, 0);

    // remove the key: free behaviour again, hint printed
    assert.equal(guardian(main, "license", "remove").code, 0);
    const free = guardian(auth, "check");
    assert.doesNotMatch(free.out, /merge plan \(Pro/);
    assert.match(free.out, /Pro adds a scored merge plan/);
  });
});

test("a valid key without the Pro package degrades to free with a note", () => {
  const home = mkdtempSync(path.join(tmpdir(), "guardian-pro-home-"));
  withEnv({ GUARDIAN_HOME: home, GUARDIAN_PUBKEY_PEM: PUB, GUARDIAN_PRO_PATH: path.join(home, "missing", "index.js") }, () => {
    const { main } = repoWithWorktrees();
    guardian(main, "license", "add", makeKey());
    const out = guardian(main, "check").out;
    assert.match(out, /Pro package is not installed/);
  });
});

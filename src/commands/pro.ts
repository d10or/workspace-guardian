/** `guardian pro install <tarball> | status | remove` — place the paid package under <guardian home>/pro. */
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { guardianHome } from "../lib/license.ts";
import { loadPro } from "../lib/pro.ts";
import { eprintln, json, parse, println, SCHEMA_VERSION } from "../lib/output.ts";

export const proDir = () => path.join(guardianHome(), "pro");

function untar(tgz: string, into: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile("tar", ["-xzf", tgz, "-C", into, "--strip-components=1"], (err, _out, stderr) => resolve(err ? String(stderr || err.message) : null));
  });
}

export async function pro(args: readonly string[]): Promise<number> {
  const [sub, ...rest] = args;
  const a = parse(rest, { json: { type: "boolean", default: false } }, true);
  if (!a.ok) {
    eprintln(`guardian pro: ${a.error}`);
    return 2;
  }
  if (sub === "install") {
    const tgz = a.positionals[0];
    if (!tgz || !existsSync(tgz)) {
      eprintln("usage: guardian pro install <workspace-guardian-pro-x.y.z.tgz>");
      return 2;
    }
    const stage = mkdtempSync(path.join(tmpdir(), "guardian-pro-"));
    const err = await untar(path.resolve(tgz), stage);
    if (err !== null) {
      eprintln(`guardian pro: could not unpack: ${err.trim()}`);
      rmSync(stage, { recursive: true, force: true });
      return 1;
    }
    let version = "";
    try {
      const pkg = JSON.parse(readFileSync(path.join(stage, "package.json"), "utf8"));
      version = pkg.name === "@workspace-guardian/pro" && typeof pkg.version === "string" ? pkg.version : "";
    } catch {
      version = "";
    }
    if (version === "" || !existsSync(path.join(stage, "dist", "index.js"))) {
      eprintln("guardian pro: that archive is not a Workspace Guardian Pro package");
      rmSync(stage, { recursive: true, force: true });
      return 1;
    }
    mkdirSync(guardianHome(), { recursive: true });
    rmSync(proDir(), { recursive: true, force: true });
    renameSync(stage, proDir());
    // the loader looks for <pro>/index.js; point it at the built entry
    renameSync(path.join(proDir(), "dist", "index.js"), path.join(proDir(), "index.js"));
    println(`Pro ${version} installed → ${proDir()}. Now add your key: guardian license add <key>`);
    return 0;
  }
  if (sub === "remove") {
    rmSync(proDir(), { recursive: true, force: true });
    println(`removed ${proDir()}`);
    return 0;
  }
  if (sub === "status" || sub === undefined) {
    const state = await loadPro();
    const installed = existsSync(path.join(proDir(), "index.js")) || Boolean(process.env.GUARDIAN_PRO_PATH && existsSync(process.env.GUARDIAN_PRO_PATH));
    if (a.values.json) {
      json({ schemaVersion: SCHEMA_VERSION, command: "pro status", dir: proDir(), installed, license: state.license.status, active: state.module !== null, version: state.module?.version ?? null, note: state.note });
      return 0;
    }
    println(`package  ${installed ? `installed at ${state.where ?? proDir()}` : "not installed (guardian pro install <tarball>)"}`);
    println(`key      ${state.license.status}${state.license.status === "none" ? " (guardian license add <key>)" : ""}`);
    println(`active   ${state.module ? `yes, Pro ${state.module.version}` : "no"}${state.note ? ` — ${state.note}` : ""}`);
    return 0;
  }
  eprintln("usage: guardian pro install <tarball> | status | remove");
  return 2;
}

/** `guardian license add|show|remove` — manage the offline Pro key. */
import { currentLicense, licenseFile, removeLicense, saveLicense, verifyKey } from "../lib/license.ts";
import { eprintln, json, parse, println, SCHEMA_VERSION } from "../lib/output.ts";

export async function license(args: readonly string[]): Promise<number> {
  const [sub, ...rest] = args;
  const a = parse(rest, { json: { type: "boolean", default: false } }, true);
  if (!a.ok) {
    eprintln(`guardian license: ${a.error}`);
    return 2;
  }
  if (sub === "add") {
    const key = a.positionals[0];
    if (!key) {
      eprintln("usage: guardian license add <WG1...key>");
      return 2;
    }
    const v = verifyKey(key);
    if (v.status !== "valid" && v.status !== "expired") {
      eprintln(`guardian license: key rejected (${v.status === "invalid" ? v.reason : "no key"}); nothing written`);
      return 1;
    }
    saveLicense(key);
    println(`${v.status === "expired" ? "saved, but this key expired on " + v.payload.expires : `Pro key ${v.payload.id} saved`} → ${licenseFile()}`);
    return v.status === "expired" ? 1 : 0;
  }
  if (sub === "remove") {
    removeLicense();
    println(`removed ${licenseFile()}`);
    return 0;
  }
  if (sub === "show" || sub === undefined) {
    const cur = currentLicense();
    if (a.values.json) {
      json({ schemaVersion: SCHEMA_VERSION, command: "license show", file: licenseFile(), status: cur.status, ...("payload" in cur ? { id: cur.payload.id, tier: cur.payload.tier, issued: cur.payload.issued, expires: cur.payload.expires, seats: cur.payload.seats } : {}), ...("reason" in cur ? { reason: cur.reason } : {}) });
      return 0;
    }
    if (cur.status === "none") println("no Pro key. The free core is complete without one; Pro adds the merge-order planner, policies and hotspot packs.");
    else if (cur.status === "invalid") println(`key present but invalid: ${cur.reason}`);
    else println(`${cur.status === "valid" ? "Pro" : "EXPIRED Pro"} key ${cur.payload.id} · tier ${cur.payload.tier} · issued ${cur.payload.issued} · expires ${cur.payload.expires ?? "never"} · seats ${cur.payload.seats}`);
    return 0;
  }
  eprintln("usage: guardian license add <key> | show | remove");
  return 2;
}

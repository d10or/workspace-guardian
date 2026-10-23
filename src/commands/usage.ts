/** `guardian usage` — print the local usage summary (counts only) so a user can share it voluntarily. */
import { rmSync } from "node:fs";
import { summarize, usageDir } from "../lib/usage.ts";
import { eprintln, json, parse, println, SCHEMA_VERSION } from "../lib/output.ts";

export async function usage(args: readonly string[]): Promise<number> {
  const a = parse(args, { json: { type: "boolean", default: false }, reset: { type: "boolean", default: false } });
  if (!a.ok) {
    eprintln(`guardian usage: ${a.error}`);
    return 2;
  }
  if (a.values.reset) {
    rmSync(usageDir(), { recursive: true, force: true });
    println(`removed ${usageDir()}`);
    return 0;
  }
  const s = summarize();
  if (a.values.json) {
    json({ schemaVersion: SCHEMA_VERSION, command: "usage", dir: usageDir(), ...s });
    return 0;
  }
  println(`guardian usage · local counts only, nothing is sent anywhere · ${usageDir()}`);
  if (s.files === 0) {
    println("nothing recorded yet");
    return 0;
  }
  println(`install id   ${s.installId}   first seen ${s.firstSeen}   active days ${s.activeDays}`);
  for (const [ev, c] of Object.entries(s.totals).sort()) println(`  ${ev.padEnd(18)} ${c}`);
  println(`activated: ${s.activated ? "yes" : "no"} (ran check or handoff)   repeat use: ${s.repeat ? "yes" : "no"} (activated on 2+ days)`);
  println("share it: paste this output into the alpha feedback issue if you want to. Disable recording with GUARDIAN_NO_USAGE=1; delete with --reset.");
  return 0;
}

import { parseArgs, type ParseArgsConfig } from "node:util";

export type Finding = {
  level: "risk" | "warn" | "info";
  code: string;
  message: string;
  paths?: string[];
  tasks?: string[];
  worktrees?: string[];
  fix: string;
};

export const SCHEMA_VERSION = 1;

export function parse<T extends ParseArgsConfig["options"]>(argv: readonly string[], options: T, allowPositionals = false) {
  try {
    return { ok: true as const, ...parseArgs({ args: [...argv], options, allowPositionals, strict: true }) };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
  }
}

export const println = (s = "") => process.stdout.write(s + "\n");
export const eprintln = (s = "") => process.stderr.write(s + "\n");
export const json = (value: unknown) => println(JSON.stringify(value, null, 2));

const GLYPH = { risk: "✗", warn: "!", info: "·" } as const;

export function printFindings(findings: readonly Finding[]): void {
  if (findings.length === 0) {
    println("✓ no risks found (advisory: unknown future edits are not covered)");
    return;
  }
  for (const f of findings) {
    println(`${GLYPH[f.level]} [${f.level}] ${f.message}`);
    if (f.paths?.length) println(`    paths: ${f.paths.slice(0, 8).join(", ")}${f.paths.length > 8 ? ` (+${f.paths.length - 8})` : ""}`);
    println(`    fix: ${f.fix}`);
  }
}

export function splitList(s: string | undefined): string[] {
  return (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
}

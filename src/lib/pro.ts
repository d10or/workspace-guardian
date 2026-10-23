/**
 * Loader for the Pro package. Pro is a separate, private package; the free core only knows this contract.
 * It loads only when a valid key is present AND the package is installed (GUARDIAN_PRO_PATH or
 * <guardian home>/pro/index.js). Everything degrades to free behaviour otherwise.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { currentLicense, guardianHome, type LicenseStatus } from "./license.ts";
import type { Finding } from "./output.ts";
import type { Hotspot } from "./hotspots.ts";

export type Policy = { failOn?: string[]; ignore?: string[]; warnOnly?: string[] };
export type PlanInput = {
  base: string;
  tasks: { id: string; branch: string; paths: string[] }[];
  worktrees: { path: string; branch: string; ahead: number; behind: number; changed: number }[];
  findings: Finding[];
};
export type MergePlan = { order: { id: string; branch: string; score: number; reasons: string[] }[]; steps: string[] };

export type ProModule = {
  version: string;
  loadPolicy?: (root: string) => Policy | null;
  applyPolicy?: (findings: Finding[], policy: Policy | null) => { findings: Finding[]; failOn: string[] };
  mergePlan?: (input: PlanInput) => MergePlan;
  hotspots?: (root: string) => Hotspot[];
};

export type ProState = { license: LicenseStatus; module: ProModule | null; where: string | null; note: string };

export async function loadPro(): Promise<ProState> {
  const license = currentLicense();
  if (license.status !== "valid") return { license, module: null, where: null, note: license.status === "none" ? "" : `Pro key ${license.status}` };
  const candidate = process.env.GUARDIAN_PRO_PATH || path.join(guardianHome(), "pro", "index.js");
  if (!existsSync(candidate)) return { license, module: null, where: null, note: `Pro key valid but the Pro package is not installed at ${candidate}` };
  try {
    const mod = (await import(pathToFileURL(candidate).href)) as { default?: ProModule } & Partial<ProModule>;
    const m = (mod.default ?? mod) as ProModule;
    if (typeof m.version !== "string") return { license, module: null, where: candidate, note: "Pro package has no version export" };
    return { license, module: m, where: candidate, note: "" };
  } catch (err) {
    return { license, module: null, where: candidate, note: `Pro package failed to load: ${err instanceof Error ? err.message : String(err)}` };
  }
}

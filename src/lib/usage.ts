/**
 * Local usage counters for the pilot's activation / repeat-use metrics (MASTER_PLAN.md §7).
 * Counts only: which command ran on which day, how many worktrees and tasks, whether risks were found.
 * Never a path, a branch name, a task id, or file content. Nothing is ever sent anywhere; the user can
 * print the summary with `guardian usage` and paste it voluntarily. GUARDIAN_NO_USAGE=1 disables writes.
 */
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";

export type UsageEvent = "inspect" | "check" | "check_with_risks" | "handoff" | "handoff_verified" | "task_add" | "task_done" | "session_start" | "hold_asked";

export type UsageFile = { v: 1; installId: string; firstSeen: string; days: Record<string, Partial<Record<UsageEvent, number>>> };

export function usageDir(): string {
  if (process.env.GUARDIAN_HOME) return path.join(process.env.GUARDIAN_HOME, "usage");
  const cfg = process.env.CLAUDE_CONFIG_DIR || path.join(homedir(), ".claude");
  return path.join(cfg, "guardian", "usage");
}

const today = () => new Date().toISOString().slice(0, 10);

function readFile(file: string): UsageFile | null {
  try {
    const p = JSON.parse(readFileSync(file, "utf8"));
    return p && p.v === 1 && typeof p.days === "object" ? (p as UsageFile) : null;
  } catch {
    return null;
  }
}

/** Record one event in the CLI's own file (one file per writer, so sessions never race). */
export function record(event: UsageEvent, file = path.join(usageDir(), "cli.json")): void {
  if (process.env.GUARDIAN_NO_USAGE === "1") return;
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    const cur = readFile(file) ?? { v: 1 as const, installId: randomBytes(6).toString("hex"), firstSeen: today(), days: {} };
    const d = (cur.days[today()] ??= {});
    d[event] = (d[event] ?? 0) + 1;
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(cur));
    renameSync(tmp, file);
  } catch {
    // usage is best effort; never fail a command over it
  }
}

export type UsageSummary = {
  installId: string;
  firstSeen: string;
  activeDays: number;
  totals: Partial<Record<UsageEvent, number>>;
  activated: boolean;
  repeat: boolean;
  files: number;
};

/** Merge every writer's file (cli.json, mod-<session>.json) into one summary. */
export function summarize(dir = usageDir()): UsageSummary {
  let names: string[] = [];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith(".json"));
  } catch {
    // nothing recorded yet
  }
  const totals: Partial<Record<UsageEvent, number>> = {};
  const days = new Set<string>();
  let installId = "";
  let firstSeen = "";
  for (const n of names) {
    const f = readFile(path.join(dir, n));
    if (!f) continue;
    if (n === "cli.json" || installId === "") installId = f.installId;
    if (firstSeen === "" || f.firstSeen < firstSeen) firstSeen = f.firstSeen;
    for (const [day, counts] of Object.entries(f.days)) {
      days.add(day);
      for (const [ev, c] of Object.entries(counts)) totals[ev as UsageEvent] = (totals[ev as UsageEvent] ?? 0) + (c ?? 0);
    }
  }
  const risky = (totals.check ?? 0) + (totals.handoff ?? 0);
  return { installId, firstSeen, activeDays: days.size, totals, activated: risky > 0, repeat: days.size >= 2 && risky > 0, files: names.length };
}

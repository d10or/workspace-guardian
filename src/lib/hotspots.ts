/**
 * Files that merge clean yet collide in meaning: lockfiles, migrations, schemas, generated code.
 * Two tasks touching the same category is a risk even when the filenames differ (pain point P8).
 */
import { globMatches } from "./tasks.ts";

export type Hotspot = { category: string; patterns: string[]; why: string };

export const HOTSPOTS: Hotspot[] = [
  { category: "lockfile", patterns: ["**/package-lock.json", "**/yarn.lock", "**/pnpm-lock.yaml", "**/bun.lockb", "**/Cargo.lock", "**/poetry.lock", "**/Pipfile.lock", "**/go.sum", "**/Gemfile.lock", "**/composer.lock"], why: "lockfiles merge badly; regenerate once after the last merge" },
  { category: "migration", patterns: ["**/migrations/**", "**/migrate/**", "**/db/migrate/**", "**/alembic/versions/**"], why: "two migrations with different names can still conflict on ordering or the same table" },
  { category: "schema", patterns: ["**/schema.*", "**/*.prisma", "**/*.graphql", "**/*.proto", "**/openapi.*", "**/swagger.*"], why: "a schema change in one task breaks code written against the old shape in another" },
  { category: "generated", patterns: ["**/generated/**", "**/__generated__/**", "**/*.gen.*", "**/*.pb.*"], why: "generated code should be rebuilt after merging, not merged" },
  { category: "routing", patterns: ["**/routes.*", "**/router.*", "**/urls.py", "**/*.routes.*"], why: "route tables are append-only hotspots that every feature touches" },
  { category: "config", patterns: ["package.json", "tsconfig.json", "pyproject.toml", "Cargo.toml", "go.mod", ".env.example", "**/settings.py"], why: "shared configuration edited by several tasks tends to conflict on the same lines" },
];

export function hotspotOf(rel: string): Hotspot | undefined {
  return HOTSPOTS.find((h) => h.patterns.some((p) => globMatches(p, rel)));
}

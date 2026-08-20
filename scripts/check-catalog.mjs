#!/usr/bin/env node
// Enforces the pnpm catalog in pnpm-workspace.yaml as the single source of truth for
// the version of every dependency shared by two or more workspaces.
// Runs as part of `pnpm lint` (root package.json), alongside `pnpm api:v3:lint`.
//
// Two rules, both reported together so one run lists every violation:
//
//   1. A workspace must not declare a literal version for a name the catalog lists.
//      Writing "typescript": "5.9.4" next to a catalog holding 5.9.3 is exactly the
//      drift the catalog exists to prevent, and hoisting hides it until it breaks.
//
//   2. A dependency declared by 2+ workspaces must be in the catalog. Without this
//      half, a new shared dependency simply never gets catalogued and rule 1 has
//      nothing to say about it.
//
// peerDependencies are treated differently on purpose: a peer *range* is a
// compatibility declaration for consumers, not an install pin, so it is legitimately
// looser than the catalog (packages/survey-ui declares react "^19.0.0" while pinning
// 19.2.6 to build against). Ranges are therefore exempt from both rules; an
// exact-pinned peer is not, since that is a version like any other.
//
// The workspace list is derived from pnpm-workspace.yaml's own globs — never hardcode
// it, or a newly added package silently escapes both rules.
import yaml from "js-yaml";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEP_BLOCKS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

// Specifiers that name no single version to align on.
const isRange = (spec) => /^[\^~><*]/.test(spec) || spec.includes("||");
const isNotAVersion = (spec) =>
  spec === "catalog:" ||
  spec.startsWith("catalog:") ||
  spec.startsWith("workspace:") ||
  spec.startsWith("file:") ||
  spec.startsWith("link:") ||
  spec.startsWith("npm:") ||
  spec.startsWith("git");

// Deliberate exceptions to rule 2: a dependency shared by 2+ workspaces that must NOT be
// catalogued. Add an entry only with a comment saying why the two consumers are meant to
// hold different versions — if they are meant to match, the fix is a catalog entry, not
// an exemption. Empty today, and that is the healthy state.
const ALLOW_UNCATALOGED = new Set([]);

/** Expand pnpm-workspace.yaml's `packages` globs to directories that hold a package.json. */
function resolveWorkspaceDirs(globs) {
  const dirs = new Set();
  for (const pattern of globs) {
    if (pattern.endsWith("/*")) {
      const parent = join(REPO_ROOT, pattern.slice(0, -2));
      if (!existsSync(parent)) continue;
      for (const entry of readdirSync(parent, { withFileTypes: true })) {
        if (entry.isDirectory() && existsSync(join(parent, entry.name, "package.json"))) {
          dirs.add(join(pattern.slice(0, -2), entry.name));
        }
      }
    } else if (existsSync(join(REPO_ROOT, pattern, "package.json"))) {
      dirs.add(pattern);
    }
  }
  // The root manifest is not matched by the globs but declares dependencies like any member.
  return ["", ...[...dirs].sort()];
}

const workspaceFile = yaml.load(readFileSync(join(REPO_ROOT, "pnpm-workspace.yaml"), "utf8"));
const catalog = workspaceFile.catalog ?? {};
if (Object.keys(catalog).length === 0) {
  console.error("pnpm-workspace.yaml has no `catalog:` block — nothing to enforce.");
  process.exit(1);
}

const literalViolations = [];
const declaredBy = new Map(); // dep name -> Map<workspace, spec>

for (const dir of resolveWorkspaceDirs(workspaceFile.packages ?? [])) {
  const manifestPath = join(REPO_ROOT, dir, "package.json");
  const label = dir === "" ? "package.json" : `${dir}/package.json`;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  for (const block of DEP_BLOCKS) {
    for (const [name, spec] of Object.entries(manifest[block] ?? {})) {
      if (isNotAVersion(spec)) continue;
      const exemptRange = block === "peerDependencies" && isRange(spec);
      if (exemptRange) continue;

      if (name in catalog) {
        literalViolations.push(
          `  ${label}: ${block}.${name} is "${spec}" — use "catalog:" (the catalog holds ${catalog[name]})`
        );
      } else {
        if (!declaredBy.has(name)) declaredBy.set(name, new Map());
        declaredBy.get(name).set(label, spec);
      }
    }
  }
}

const uncataloged = [...declaredBy.entries()]
  .filter(([name, uses]) => uses.size >= 2 && !ALLOW_UNCATALOGED.has(name))
  .map(([name, uses]) => {
    const where = [...uses.entries()].map(([label, spec]) => `${label} (${spec})`).join(", ");
    return `  "${name}" is declared by ${uses.size} workspaces but is not in the catalog: ${where}`;
  });

if (literalViolations.length === 0 && uncataloged.length === 0) {
  console.log(`✓ catalog check passed (${Object.keys(catalog).length} catalogued dependencies)`);
  process.exit(0);
}

if (literalViolations.length > 0) {
  console.error(`\n✗ Literal version for a catalogued dependency (${literalViolations.length}):\n`);
  console.error(literalViolations.join("\n"));
  console.error(`\n  Replace the version with "catalog:". To change the version itself, edit the`);
  console.error(`  entry in pnpm-workspace.yaml so every consumer moves together.`);
}

if (uncataloged.length > 0) {
  console.error(`\n✗ Shared dependency missing from the catalog (${uncataloged.length}):\n`);
  console.error(uncataloged.join("\n"));
  console.error(`\n  Add it to the \`catalog:\` block in pnpm-workspace.yaml and point each`);
  console.error(`  consumer at "catalog:". If the versions are meant to differ, add the name to`);
  console.error(`  ALLOW_UNCATALOGED in this script with a comment explaining why.`);
}

console.error("");
process.exit(1);

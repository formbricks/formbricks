#!/usr/bin/env node
/*
 * Writes apps/web/formbricks-rules-baseline.json: for each formbricks/* rule from ENG-7325, the apps/web files
 * that already broke it when it was turned on. apps/web/oxlint.config.ts turns the rule off in exactly those
 * files, so the rule is an error for every other file. oxlint has no bulk-suppression baseline (ESLint's
 * eslint-suppressions.json), so this per-file list stands in for one.
 *
 *   pnpm lint:formbricks-baseline           rewrite the file (after fixing a grandfathered file)
 *   pnpm lint:formbricks-baseline --check   fail when the file lists a file that no longer violates the rule
 *
 * Only removals are expected: a new violation in a file outside the list is a lint error, not a reason to
 * regenerate.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const webDir = path.join(root, "apps/web");
const baselinePath = path.join(webDir, "formbricks-rules-baseline.json");

// The rules this baseline covers. The plugin's older rules (restricted-syntax, no-inline-lint-config)
// have no backlog and are not grandfathered.
export const BASELINED_RULES = [
  "content-disposition-helper",
  "deletion-service",
  "gate-predicate",
  "loggable-error",
  "raw-upload-read",
  "spreadsheet-writer",
  "strict-input-object",
  "tenant-scoped-where",
].map((name) => `formbricks/${name}`);

const require = createRequire(import.meta.url);
const oxlintPkgPath = require.resolve("oxlint/package.json");
const OXLINT_CLI = path.join(
  path.dirname(oxlintPkgPath),
  JSON.parse(readFileSync(oxlintPkgPath, "utf8")).bin.oxlint
);

/** `formbricks(loggable-error)` → `formbricks/loggable-error`. */
const ruleIdOf = (code) => (code ?? "").replace(/^([^()]+)\((.+)\)$/, "$1/$2");

/** Rule → sorted, de-duplicated files, from oxlint's JSON diagnostics. Rules with no hits are left out. */
export const baselineFromDiagnostics = (diagnostics) => {
  const filesByRule = new Map(BASELINED_RULES.map((rule) => [rule, new Set()]));
  for (const diagnostic of diagnostics) {
    filesByRule.get(ruleIdOf(diagnostic.code))?.add(diagnostic.filename.split(path.sep).join("/"));
  }
  return Object.fromEntries(
    [...filesByRule].filter(([, files]) => files.size > 0).map(([rule, files]) => [rule, [...files].sort()])
  );
};

/** Entries in `committed` whose file no longer violates the rule. */
export const staleEntries = (committed, current) =>
  Object.entries(committed).flatMap(([rule, files]) =>
    files.filter((file) => !(current[rule] ?? []).includes(file)).map((file) => `${rule}  ${file}`)
  );

const lintWithoutBaseline = () => {
  const { stdout, stderr, error } = spawnSync(process.execPath, [OXLINT_CLI, "--format", "json"], {
    cwd: webDir,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    env: {
      ...process.env,
      FORMBRICKS_RULES_BASELINE: "off",
      NODE_OPTIONS: "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
    },
  });
  if (error) throw error;
  try {
    return JSON.parse(stdout).diagnostics;
  } catch {
    throw new Error(`oxlint printed no JSON report:\n${stderr}`);
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const current = baselineFromDiagnostics(lintWithoutBaseline());
  if (process.argv.includes("--check")) {
    const stale = staleEntries(JSON.parse(readFileSync(baselinePath, "utf8")), current);
    if (stale.length > 0) {
      console.error(
        `formbricks-rules-baseline.json grandfathers files that no longer break the rule. Run \`pnpm lint:formbricks-baseline\` and commit the file:\n${stale.join("\n")}`
      );
      process.exit(1);
    }
    console.log("✓ formbricks-rules-baseline.json lists only files that still break their rule");
  } else {
    writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
    const count = Object.values(current).reduce((sum, files) => sum + files.length, 0);
    console.log(`Wrote ${count} grandfathered file/rule pairs to apps/web/formbricks-rules-baseline.json`);
  }
}

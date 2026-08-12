#!/usr/bin/env node
/**
 * Unlocks enterprise-gated features in a LOCAL TEST environment only.
 *
 * CI runs E2E with a real ENTERPRISE_LICENSE_KEY (.github/workflows/e2e.yml). Without one, every
 * paid surface — access control, quotas, contacts, dashboards, workflows, SSO, whitelabel — is
 * hidden, so a QA pass silently skips them and reports nothing wrong.
 *
 * This inserts an early return into the license-check helpers, guarded by an env var so the patched
 * code still behaves normally unless E2E_BYPASS_LICENSE=1 is set at runtime.
 *
 *   node scripts/enable-enterprise-for-testing.mjs          # apply
 *   node scripts/enable-enterprise-for-testing.mjs --revert # restore
 *
 * NEVER COMMIT THE PATCHED FILE. Revert before creating any branch or commit.
 * Findings on paid features must state that the license was bypassed — a bug that only reproduces
 * under bypass may be an artifact of it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = resolve(REPO_ROOT, "apps/web/modules/ee/license-check/lib/utils.ts");
const MARKER = "E2E_BYPASS_LICENSE";
const revert = process.argv.includes("--revert");

const source = readFileSync(TARGET, "utf8");

if (revert) {
  if (!source.includes(MARKER)) {
    console.log("Not patched; nothing to revert.");
    process.exit(0);
  }
  const cleaned = source
    .split("\n")
    .filter((line) => !line.includes(MARKER))
    .join("\n");
  writeFileSync(TARGET, cleaned);
  console.log(`Reverted ${TARGET}`);
  process.exit(0);
}

if (source.includes(MARKER)) {
  console.log("Already patched.");
  process.exit(0);
}

// Every gate on self-hosted resolves through a boolean-returning arrow function in this file —
// including the three private helpers the exported checks delegate to. Patching all of them
// uniformly avoids depending on any single function name surviving refactors.
const BOOL_FN = /(=\s*async\s*\([^)]*\)\s*:\s*Promise<boolean>\s*=>\s*\{)/g;
const NUM_FN = /(export const getOrganizationWorkspacesLimit[^{]*\{)/;

let boolPatches = 0;
let patched = source.replace(BOOL_FN, (match) => {
  boolPatches += 1;
  return `${match}\n  if (process.env.${MARKER} === "1") return true;`;
});

let numPatches = 0;
patched = patched.replace(NUM_FN, (match) => {
  numPatches += 1;
  return `${match}\n  if (process.env.${MARKER} === "1") return Number.MAX_SAFE_INTEGER;`;
});

// Fail loudly rather than silently producing a no-op patch if the file was restructured upstream.
if (boolPatches === 0) {
  console.error(
    `No boolean license checks matched in ${TARGET}.\n` +
      "The file's shape changed upstream — update this codemod before trusting a QA run."
  );
  process.exit(1);
}

writeFileSync(TARGET, patched);
console.log(`Patched ${boolPatches} boolean check(s) and ${numPatches} limit(s) in ${TARGET}`);
console.log(`Set ${MARKER}=1 in the environment to activate. Do not commit this file.`);

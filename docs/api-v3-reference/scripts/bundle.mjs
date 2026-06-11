#!/usr/bin/env node
/* Single entry point for the v3 OpenAPI spec tooling (pins @redocly/cli in exactly one place).
 *
 *   node docs/api-v3-reference/scripts/bundle.mjs          # regenerate docs/api-v3-reference/openapi.yml
 *   node docs/api-v3-reference/scripts/bundle.mjs --check  # fail if the committed artifact is stale
 *   node docs/api-v3-reference/scripts/bundle.mjs --lint   # lint the multi-file source tree
 *
 * Mintlify only resolves $refs inside a single document, so the committed openapi.yml must stay a
 * self-contained bundle. The --check mode compares canonical JSON (sorted keys) so comments and
 * YAML formatting never cause false positives. Lint runs with docs/api-v3-reference as cwd so
 * redocly.yaml and .redocly.lint-ignore.yaml are picked up. Stdlib only — safe to run in CI
 * without installing workspace dependencies.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Fallback pin for environments without the workspace install. Keep in sync with the
// @redocly/cli entry in the root package.json devDependencies (the preferred, lockfile-pinned path).
const REDOCLY_NPX_FALLBACK = "@redocly/cli@1.34.3";
const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../src/openapi.yml");
const artifact = resolve(here, "../openapi.yml");

const localRedoclyBin = (() => {
  try {
    const pkgPath = createRequire(import.meta.url).resolve("@redocly/cli/package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const binRel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin.redocly;
    return join(dirname(pkgPath), binRel);
  } catch {
    return null;
  }
})();

const HEADER = `# GENERATED FILE — do not edit. Source of truth: docs/api-v3-reference/src/ (one file per path/schema).
# Regenerate with \`pnpm api:v3:bundle\`; CI verifies freshness with \`pnpm api:v3:check\`.
# V3 API — Surveys and Workflows extension (hand-maintained source; not produced by generate-api-specs).
`;

const redocly = (args, opts = {}) =>
  localRedoclyBin
    ? execFileSync(process.execPath, [localRedoclyBin, ...args], {
        stdio: ["ignore", "pipe", "inherit"],
        ...opts,
      })
    : execFileSync("npx", ["-y", REDOCLY_NPX_FALLBACK, ...args], {
        stdio: ["ignore", "pipe", "inherit"],
        ...opts,
      });

// Code-unit comparison, NOT localeCompare: the canonical form must be byte-identical across
// machines and locales (RFC 8785-style ordering), and localeCompare depends on the ICU build.
const compareCodeUnits = (a, b) => {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
};

const sortKeys = (value) => {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareCodeUnits)
        .map((key) => [key, sortKeys(value[key])])
    );
  }
  return value;
};

const canonical = (jsonFile) => JSON.stringify(sortKeys(JSON.parse(readFileSync(jsonFile, "utf8"))));

if (process.argv.includes("--lint")) {
  try {
    redocly(["lint", "src/openapi.yml"], { stdio: "inherit", cwd: resolve(here, "..") });
  } catch (error) {
    process.exit(typeof error.status === "number" ? error.status : 1);
  }
} else if (process.argv.includes("--check")) {
  const tmp = mkdtempSync(join(tmpdir(), "v3-spec-"));
  try {
    redocly(["bundle", srcRoot, "-o", join(tmp, "from-src.json"), "--ext", "json"]);
    redocly(["bundle", artifact, "-o", join(tmp, "from-artifact.json"), "--ext", "json"]);
    if (canonical(join(tmp, "from-src.json")) !== canonical(join(tmp, "from-artifact.json"))) {
      console.error(
        "✗ docs/api-v3-reference/openapi.yml is out of sync with docs/api-v3-reference/src/.\n" +
          "  Run `pnpm api:v3:bundle` and commit the result."
      );
      process.exit(1);
    }
    console.log("✓ openapi.yml bundle is in sync with src/.");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
} else {
  redocly(["bundle", srcRoot, "-o", artifact]);
  writeFileSync(artifact, HEADER + readFileSync(artifact, "utf8"));
  console.log(`✓ bundled src/ → ${artifact}`);
}

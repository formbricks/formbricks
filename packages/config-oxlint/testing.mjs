import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/*
 * Test helper for config regression tests: lints source snippets as if they sat at given paths inside
 * a workspace, through that workspace's real oxlint config.
 *
 * oxlint has no lint-text API, so the snippets are written to a throwaway directory next to the
 * workspace's `oxlint.config.ts`, holding a config that re-exports it. oxlint uses the nearest config,
 * and its globs resolve against the throwaway directory exactly as they would against the workspace,
 * so `lib/env.ts` here matches the config's `lib/env.ts` glob without touching the real file.
 */

const require = createRequire(import.meta.url);
const oxlintPkgPath = require.resolve("oxlint/package.json");
const OXLINT_CLI = path.join(
  path.dirname(oxlintPkgPath),
  JSON.parse(readFileSync(oxlintPkgPath, "utf8")).bin.oxlint
);

/** `typescript(no-explicit-any)` → `typescript/no-explicit-any`; core rules drop the `eslint` scope. */
export const ruleIdOf = (code) => {
  const match = /^([^()]+)\((.+)\)$/.exec(code ?? "");
  if (!match) return null;
  const [, scope, name] = match;
  return scope === "eslint" ? name : `${scope}/${name}`;
};

/**
 * Lints `files` (a map of workspace-relative path → source) against the config in `workspaceDir`.
 * Returns each file's diagnostics as `{ ruleId, severity, message, line }`, keyed by the same path.
 * `typeAware` runs the type-aware rules too (as `pnpm lint:code` does); the fixtures then need to sit
 * where the workspace's tsconfig includes them.
 */
export function lintFixtures(workspaceDir, files, options = {}) {
  return runFixtures(workspaceDir, files, options).results;
}

/**
 * Runs `oxlint --fix` on `files` as `lintFixtures` lints them, and returns each file's source after
 * the fixes, keyed by the same path.
 */
export function fixFixtures(workspaceDir, files, options = {}) {
  return runFixtures(workspaceDir, files, { ...options, fix: true }).sources;
}

function runFixtures(workspaceDir, files, { env = {}, typeAware = false, fix = false } = {}) {
  const fixtureDir = mkdtempSync(path.join(workspaceDir, "oxlint-fixtures-"));
  try {
    writeFileSync(
      path.join(fixtureDir, "oxlint.config.ts"),
      'export { default } from "../oxlint.config.ts";\n'
    );
    for (const [relativePath, source] of Object.entries(files)) {
      const target = path.join(fixtureDir, relativePath);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, source);
    }
    const { stdout, stderr, error } = spawnSync(
      process.execPath,
      [
        OXLINT_CLI,
        "--format",
        "json",
        ...(typeAware ? ["--type-aware"] : []),
        ...(fix ? ["--fix"] : []),
        ...Object.keys(files).map((file) => path.join(fixtureDir, file)),
      ],
      {
        cwd: workspaceDir,
        encoding: "utf8",
        env: {
          ...process.env,
          ...env,
          NODE_OPTIONS: "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        },
      }
    );
    if (error) throw error;
    let report;
    try {
      report = JSON.parse(stdout);
    } catch {
      throw new Error(`oxlint printed no JSON report:\n${stdout}\n${stderr}`);
    }
    const results = Object.fromEntries(Object.keys(files).map((file) => [file, []]));
    for (const diagnostic of report.diagnostics) {
      const file = path
        .relative(fixtureDir, path.resolve(workspaceDir, diagnostic.filename))
        .split(path.sep)
        .join("/");
      results[file]?.push({
        ruleId: ruleIdOf(diagnostic.code),
        severity: diagnostic.severity,
        message: diagnostic.message,
        line: diagnostic.labels?.[0]?.span.line,
      });
    }
    const sources = Object.fromEntries(
      Object.keys(files).map((file) => [file, readFileSync(path.join(fixtureDir, file), "utf8")])
    );
    return { results, sources };
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
}

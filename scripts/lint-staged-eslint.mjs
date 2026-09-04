#!/usr/bin/env node
/* ESLint runner for the lint-staged pre-commit hook.
 *
 * lint-staged appends the staged file list to this command as separate argv
 * entries, and ESLint is spawned through node with no shell in between, so no
 * path is ever interpolated into a command string. The previous `sh -c 'cd … &&
 * eslint "…"'` form broke on any path containing a double quote, `$` or a
 * backtick — and would have run whatever such a path contained.
 *
 * Each touched package is linted from its own directory so ESLint 9 resolves
 * that package's flat config, and only the staged files are passed, so a commit
 * doesn't pay for pre-existing violations elsewhere in the package.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// ESLint doesn't export ./bin/eslint.js, but package.json is exported, so go
// through it to get an absolute path to the CLI entry point.
const eslintPkgPath = createRequire(import.meta.url).resolve("eslint/package.json");
const ESLINT_CLI = path.join(
  path.dirname(eslintPkgPath),
  JSON.parse(readFileSync(eslintPkgPath, "utf8")).bin.eslint
);

// The `config-*` packages ship the shared presets themselves and have no
// eslint.config.* of their own, so `turbo run lint` skips them (they declare no
// lint script). Skip them here too — ESLint otherwise aborts with "couldn't
// find an eslint.config file" and fails the whole commit.
function hasEslintConfig(pkgDir) {
  return ["mjs", "js", "cjs", "ts"].some((ext) => existsSync(path.join(pkgDir, `eslint.config.${ext}`)));
}

// Groups staged files by their owning app/package directory (e.g. "apps/web",
// "packages/database"), each exactly one level under apps/ or packages/.
function groupByPackage(files) {
  const groups = new Map();
  for (const file of files) {
    const rel = path.relative(process.cwd(), path.resolve(file)).split(path.sep).join("/");
    const match = /^(apps|packages)\/([^/]+)\//.exec(rel);
    if (!match) continue;
    const pkgDir = `${match[1]}/${match[2]}`;
    if (!groups.has(pkgDir)) groups.set(pkgDir, []);
    groups.get(pkgDir).push(path.relative(pkgDir, rel));
  }
  return groups;
}

let failed = false;
for (const [pkgDir, relFiles] of groupByPackage(process.argv.slice(2))) {
  if (!hasEslintConfig(pkgDir)) continue;
  const { status, error } = spawnSync(process.execPath, [ESLINT_CLI, ...relFiles], {
    cwd: pkgDir,
    stdio: "inherit",
  });
  if (error) throw error;
  if (status !== 0) failed = true;
}

process.exit(failed ? 1 : 0);

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
import { SONAR_PARITY_RULE_IDS } from "../packages/config-eslint/sonar-parity.mjs";
import { parseStagedLineRanges, touchesStagedLines } from "./staged-lines.mjs";

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

/*
 * SonarCloud judges a pull request's new code only, and much existing code is over its limits. A
 * commit fails on a Sonar-parity rule (`SONAR_PARITY_RULE_IDS`, packages/config-eslint/sonar-parity.mjs)
 * only inside the lines it stages, as Sonar would on the PR.
 */
const SONAR_RULES = new Set(SONAR_PARITY_RULE_IDS);

const isTracked = (file) =>
  spawnSync("git", ["ls-files", "--error-unmatch", "--", file], { stdio: "ignore" }).status === 0;

/**
 * The staged lines of `file`, from the index. A file git does not track is new code throughout.
 * Throws when git can't say: the gate must not pass blind.
 */
function stagedLineRanges(file) {
  if (!isTracked(file)) return [[1, Number.POSITIVE_INFINITY]];
  const { stdout, stderr, status, error } = spawnSync(
    "git",
    ["diff", "--cached", "--unified=0", "--", file],
    {
      encoding: "utf8",
    }
  );
  if (error || status !== 0) {
    throw new Error(`git diff --cached failed for ${file}: ${error?.message ?? stderr}`);
  }
  return parseStagedLineRanges(stdout);
}

const format = (file, message, label) =>
  `${file}:${message.line}:${message.column}  ${label}  ${message.message}  ${message.ruleId ?? ""}`;

let failed = false;
for (const [pkgDir, relFiles] of groupByPackage(process.argv.slice(2))) {
  if (!hasEslintConfig(pkgDir)) continue;
  const { status, error, stdout, stderr } = spawnSync(
    process.execPath,
    [ESLINT_CLI, "--format", "json", ...relFiles],
    {
      cwd: pkgDir,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      // The Sonar-parity rules (packages/config-eslint/sonar-parity.mjs) are off for the whole-repo
      // lint until the backlog is fixed. Here they report as warnings, and the loop below fails the
      // commit on one only inside the lines it stages.
      env: { ...process.env, ESLINT_SONAR_PARITY: "warn" },
    }
  );
  if (error) throw error;
  if (stderr) process.stderr.write(stderr);
  // A crash (bad config, parse failure) prints no JSON: report it as it came.
  let results;
  try {
    results = JSON.parse(stdout);
  } catch {
    process.stdout.write(stdout);
    failed = true;
    continue;
  }
  if (status !== 0 && status !== 1) failed = true;

  for (const result of results) {
    const file = path.relative(process.cwd(), result.filePath);
    const ranges = result.messages.some((message) => SONAR_RULES.has(message.ruleId))
      ? stagedLineRanges(file)
      : [];
    for (const message of result.messages) {
      if (message.severity === 2) {
        console.log(format(file, message, "error"));
        failed = true;
      } else if (SONAR_RULES.has(message.ruleId) && touchesStagedLines(message, ranges)) {
        console.log(format(file, message, "error (SonarCloud, new code)"));
        failed = true;
      }
    }
  }
}

process.exit(failed ? 1 : 0);

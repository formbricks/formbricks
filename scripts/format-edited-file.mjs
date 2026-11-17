#!/usr/bin/env node
/* Claude Code `PostToolUse` hook (.claude/settings.json): formats the file an agent just edited, so the
 * agent reads on from formatted code and its diffs carry no formatting noise. It does what the
 * lint-staged hook does to a staged file: sort the keys of a locale file, run oxfmt, then sort the names
 * inside import braces in workspace code (oxlint with only `sort-imports` on). lint-staged
 * and `pnpm format:check` in CI stay the checks that fail; this hook never blocks the agent, so a file
 * that doesn't parse yet (an edit halfway through) is left as it is.
 *
 * Claude Code passes the tool call as JSON on stdin; the edited path is `tool_input.file_path`.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isLocaleFile } from "./sort-locale-keys.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let filePath;
try {
  filePath = JSON.parse(readFileSync(0, "utf8"))?.tool_input?.file_path;
} catch {
  process.exit(0);
}
if (typeof filePath !== "string") process.exit(0);

const relativePath = path.relative(repoRoot, path.resolve(filePath));
if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) process.exit(0);
const repoPath = relativePath.split(path.sep).join("/");

if (isLocaleFile(repoPath)) {
  spawnSync(process.execPath, [path.join(repoRoot, "scripts/sort-locale-keys.mjs"), relativePath], {
    cwd: repoRoot,
    stdio: "ignore",
  });
}

// Neither oxfmt nor oxlint exports its bin, but both export package.json, so go through it to the CLI.
const require = createRequire(import.meta.url);
const binOf = (name) => {
  const pkgPath = require.resolve(`${name}/package.json`);
  return path.join(path.dirname(pkgPath), JSON.parse(readFileSync(pkgPath, "utf8")).bin[name]);
};
const run = (cli, args) => spawnSync(process.execPath, [cli, ...args], { cwd: repoRoot, stdio: "ignore" });

run(binOf("oxfmt"), ["--no-error-on-unmatched-pattern", relativePath]);

// The same files the lint-staged `sort-imports` fix covers.
if (/^(apps|packages)\/.+\.(js|ts|jsx|tsx|mjs)$/.test(repoPath)) {
  run(binOf("oxlint"), ["-c", "scripts/oxlint-sort-imports.config.mjs", "--fix", relativePath]);
}

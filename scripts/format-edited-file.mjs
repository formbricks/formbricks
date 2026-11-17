#!/usr/bin/env node
/* Claude Code `PostToolUse` hook (.claude/settings.json): formats the file an agent just edited, so the
 * agent reads on from formatted code and its diffs carry no formatting noise. It does what the
 * lint-staged hook does to a staged file: sort the keys of a locale file, then run oxfmt. lint-staged
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

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const isLocaleFile = (relativePath) =>
  /^(apps\/web|packages\/surveys)\/locales\/[^/]+\.json$/.test(relativePath.split(path.sep).join("/"));

let filePath;
try {
  filePath = JSON.parse(readFileSync(0, "utf8"))?.tool_input?.file_path;
} catch {
  process.exit(0);
}
if (typeof filePath !== "string") process.exit(0);

const relativePath = path.relative(repoRoot, path.resolve(filePath));
if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) process.exit(0);

if (isLocaleFile(relativePath)) {
  spawnSync(process.execPath, [path.join(repoRoot, "scripts/sort-locale-keys.mjs"), relativePath], {
    cwd: repoRoot,
    stdio: "ignore",
  });
}

// oxfmt doesn't export its bin, but package.json is exported, so go through it to the CLI entry point.
const oxfmtPkgPath = createRequire(import.meta.url).resolve("oxfmt/package.json");
const oxfmtCli = path.join(
  path.dirname(oxfmtPkgPath),
  JSON.parse(readFileSync(oxfmtPkgPath, "utf8")).bin.oxfmt
);
spawnSync(process.execPath, [oxfmtCli, "--no-error-on-unmatched-pattern", relativePath], {
  cwd: repoRoot,
  stdio: "ignore",
});

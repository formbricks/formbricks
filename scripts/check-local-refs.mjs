#!/usr/bin/env node
// Fails when a tracked file points into `.local/`, the gitignored scratch folder each developer
// keeps for notes, plans and drafts. Its contents exist on one machine only, so a code comment or
// doc that cites `.local/plan.md` sends every other reader to a file they cannot open.
// Runs as part of `pnpm lint` (root package.json), next to `pnpm catalog:check`.
//
// Only the folder is matched, not every `.local/` substring: a hostname such as
// `cube.formbricks.local/` is preceded by a hostname character, and a home-directory path such as
// `~/.local/bin` or `/root/.local/bin` is the XDG user folder rather than this repo's.
import { execFileSync } from "node:child_process";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// `.local/` not glued to a preceding hostname label (`formbricks.local/`, `internal.local/`).
const LOCAL_FOLDER = /(?<![\w-])\.local\//g;
// Text right before a match that makes it a home-directory path, not the repo's scratch folder.
const HOME_DIR_PREFIX = /(?:~|\$HOME|\$\{HOME\}|\/root|\/home\/[\w.-]+)\/$/;

// Files that have to name the folder to do their job: the ignore rules that keep it untracked,
// the ESLint ignore entry that keeps type-aware linting off it, and this check with its test.
const ALLOWED_BASENAMES = new Set([".gitignore", ".worktreeinclude"]);
const ALLOWED_PATHS = new Set([
  "packages/config-eslint/base.mjs",
  "scripts/check-local-refs.mjs",
  "scripts/check-local-refs.test.ts",
]);

/** Whether a line of text references the `.local/` scratch folder. */
export function mentionsLocalFolder(line) {
  for (const match of line.matchAll(LOCAL_FOLDER)) {
    if (!HOME_DIR_PREFIX.test(line.slice(0, match.index))) return true;
  }
  return false;
}

/** Whether a repo-relative path may name the folder. */
export function isAllowedFile(path) {
  return ALLOWED_PATHS.has(path) || ALLOWED_BASENAMES.has(basename(path));
}

/**
 * Splits `git grep -z -n` output into `{ path, line, text }`. With `-z` each hit reads
 * `path\0lineNumber\0text`, so a path containing a colon cannot be misparsed.
 */
export function parseGitGrepOutput(output) {
  return output
    .split("\n")
    .filter(Boolean)
    .map((record) => {
      const [path, line, ...text] = record.split("\0");
      return { path, line: Number(line), text: text.join("\0") };
    });
}

function findViolations() {
  let output;
  try {
    // Tracked files only (`.local/` itself is ignored), text only (`-I`), fixed string as a cheap
    // prefilter; `mentionsLocalFolder` then decides.
    output = execFileSync("git", ["grep", "-z", "-n", "-I", "-F", "-e", ".local/"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    // git grep exits 1 when nothing matches at all; anything else is a real failure.
    if (error.status === 1) return [];
    throw error;
  }
  return parseGitGrepOutput(output).filter(
    ({ path, text }) => !isAllowedFile(path) && mentionsLocalFolder(text)
  );
}

function main() {
  const violations = findViolations();
  if (violations.length === 0) {
    console.log("✓ no tracked file references the .local/ scratch folder");
    return 0;
  }
  console.error(`\n✗ Reference to the untracked .local/ scratch folder (${violations.length}):\n`);
  for (const { path, line, text } of violations) console.error(`  ${path}:${line}: ${text.trim()}`);
  console.error(`\n  .local/ is gitignored, so nobody else can open what these point to. Move the`);
  console.error(`  content somewhere tracked (docs/, an ADR, the ticket) and reference that instead.`);
  console.error(`  If a file genuinely has to name the folder, add it to ALLOWED_PATHS in`);
  console.error(`  scripts/check-local-refs.mjs.\n`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}

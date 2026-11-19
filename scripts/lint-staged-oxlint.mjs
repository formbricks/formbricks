#!/usr/bin/env node
/* oxlint runner for the lint-staged pre-commit hook.
 *
 * lint-staged appends the staged file list to this command as separate argv entries, and oxlint is
 * spawned through node with no shell in between, so no path is ever interpolated into a command
 * string.
 *
 * oxlint runs once, from the repo root, on the staged files only: each file is checked against its
 * workspace's oxlint.config.ts (the nearest config), so a commit doesn't pay for pre-existing
 * violations elsewhere in the package. Any error fails the commit.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { STAGED_LINES_RULE_IDS } from "../packages/config-oxlint/sonar-parity.mjs";
import { missingBuildsHint, missingLintBuilds } from "./lint-builds.mjs";
import { decodeSonarMessage, parseStagedLineRanges, touchesStagedCode } from "./staged-lines.mjs";

// oxlint doesn't export its bin, but package.json is exported, so go through it to get an
// absolute path to the CLI entry point.
const oxlintPkgPath = createRequire(import.meta.url).resolve("oxlint/package.json");
const OXLINT_CLI = path.join(
  path.dirname(oxlintPkgPath),
  JSON.parse(readFileSync(oxlintPkgPath, "utf8")).bin.oxlint
);

/*
 * SonarCloud judges a pull request's new code only, and existing code is still over some of its
 * limits. A commit fails on such a rule (`STAGED_LINES_RULE_IDS`, packages/config-oxlint/sonar-parity.mjs)
 * only inside the lines it stages, as Sonar would on the PR.
 */
const STAGED_LINES_RULES = new Set(STAGED_LINES_RULE_IDS);

/** `sonarjs(cognitive-complexity)` → `sonarjs/cognitive-complexity`; core rules drop the `eslint` scope. */
export const ruleIdOf = (code) => {
  const match = /^([^()]+)\((.+)\)$/.exec(code ?? "");
  if (!match) return null;
  const [, scope, name] = match;
  return scope === "eslint" ? name : `${scope}/${name}`;
};

const isTracked = (file) =>
  spawnSync("git", ["ls-files", "--error-unmatch", "--", file], { stdio: "ignore" }).status === 0;

/**
 * The lines of `file` this commit changes, as oxlint sees them. Compared with HEAD's working tree,
 * not the index: lint-staged hides unstaged changes while its tasks run, so the working tree holds
 * the staged content after `prettier --write` reflowed it, which is the file oxlint lints. A file git
 * does not track is new code throughout. Throws when git can't say: the gate must not pass blind.
 */
function stagedLineRanges(file) {
  if (!isTracked(file)) return [[1, Number.POSITIVE_INFINITY]];
  const { stdout, stderr, status, error } = spawnSync("git", ["diff", "HEAD", "--unified=0", "--", file], {
    encoding: "utf8",
  });
  if (error || status !== 0) {
    throw new Error(`git diff HEAD failed for ${file}: ${error?.message ?? stderr}`);
  }
  return parseStagedLineRanges(stdout);
}

/* oxlint reports a span as a start line plus a UTF-8 byte offset and length; the end line comes from
 * the source, sliced as bytes so non-ASCII text before the span cannot shift it. */
const endLineOf = (file, span) => {
  const spanText = readFileSync(file)
    .subarray(span.offset, span.offset + span.length)
    .toString("utf8");
  return span.line + (spanText.match(/\n/g)?.length ?? 0);
};

const format = (file, message, label) =>
  `${file}:${message.line}:${message.column}  ${label}  ${message.message}  ${message.ruleId ?? ""}`;

const files = process.argv
  .slice(2)
  .map((file) => path.relative(process.cwd(), path.resolve(file)).split(path.sep).join("/"));

/*
 * Every tier runs type-aware rules, apps/web's `next` tier included, so oxlint always gets
 * `--type-aware`: oxlint-tsgolint then builds the TypeScript program of each staged file's workspace.
 */
function runOxlint(paths) {
  if (paths.length === 0) return { diagnostics: [], failed: false };
  const { status, error, stdout, stderr } = spawnSync(
    process.execPath,
    [OXLINT_CLI, "--format", "json", "--no-error-on-unmatched-pattern", "--type-aware", ...paths],
    {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: {
        ...process.env,
        // The staged-lines rules (none today) are off for the whole-repo lint until their backlog is
        // fixed. Here they report as warnings, and the loop below fails the commit on one only inside
        // the staged lines.
        OXLINT_SONAR_PARITY: "warn",
        // oxlint.config.ts in a package without "type": "module" makes Node print a warning per run.
        NODE_OPTIONS: [process.env.NODE_OPTIONS, "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON"]
          .filter(Boolean)
          .join(" "),
      },
    }
  );
  if (error) throw error;
  if (stderr) process.stderr.write(stderr);
  // A crash (bad config, parse failure) prints no JSON: report it as it came.
  try {
    return { diagnostics: JSON.parse(stdout).diagnostics, failed: status !== 0 && status !== 1 };
  } catch {
    process.stdout.write(stdout);
    return { diagnostics: [], failed: true };
  }
}

const runs = [runOxlint(files)];

let failed = runs.some((run) => run.failed);
const rangesByFile = new Map();
for (const diagnostic of runs.flatMap((run) => run.diagnostics)) {
  const span = diagnostic.labels?.[0]?.span ?? { line: 1, column: 1, offset: 0, length: 0 };
  const message = decodeSonarMessage({
    ruleId: ruleIdOf(diagnostic.code),
    message: diagnostic.message,
    line: span.line,
    column: span.column,
    endLine: endLineOf(diagnostic.filename, span),
  });
  if (diagnostic.severity === "error") {
    console.log(format(diagnostic.filename, message, "error"));
    failed = true;
  } else if (STAGED_LINES_RULES.has(message.ruleId)) {
    if (!rangesByFile.has(diagnostic.filename)) {
      rangesByFile.set(diagnostic.filename, stagedLineRanges(diagnostic.filename));
    }
    if (touchesStagedCode(message, rangesByFile.get(diagnostic.filename))) {
      console.log(format(diagnostic.filename, message, "error (SonarCloud, new code)"));
      failed = true;
    }
  }
}

/*
 * Unlike `pnpm lint`, the hook builds nothing first. In a fresh clone the packages the type-aware
 * rules read types from have no dist/, which can fail a commit on code that is fine: say so.
 */
if (failed) {
  const missing = missingLintBuilds(process.cwd());
  if (missing.length > 0) console.log(missingBuildsHint(missing));
}

process.exit(failed ? 1 : 0);

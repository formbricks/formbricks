#!/usr/bin/env node
// Keeps sonar-project.properties in step with the workspaces. A package that runs `test:coverage` but
// is missing from the Sonar lists is analysed by nothing and counts toward no gate (ENG-2432 found
// eight such packages; packages/mcp-views was added to the repo without being listed and only a code
// review noticed). Runs as part of `pnpm lint`, next to `pnpm catalog:check`.
//
// Every workspace with a `test:coverage` script must appear in all four lists, which have to be
// extended together (a package in `sources` without its lcov report reads as 0% covered):
//   sonar.sources, sonar.tests, sonar.javascript.lcov.reportPaths (`<dir>/coverage/lcov.info`) and
//   sonar.typescript.tsconfigPath (`<dir>/tsconfig.json`).
// A package that must stay out goes into OUT_OF_SCOPE with the reason; an empty reason is a failure.
import yaml from "js-yaml";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const OUT_OF_SCOPE = {
  "packages/vite-plugins":
    "build tooling: one test, and its vitest config emits clover rather than lcov, so enrolling it means a reporter change first",
  "apps/deployment-check": "deployment smoke tool, not product code",
  docker: "compose and shell contract tests for the image, no product code",
};

const listOf = (properties, key) =>
  (properties.get(key) ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

/** `key=value` lines of a .properties file. Comments and blank lines are skipped. */
export const parseProperties = (text) => {
  const properties = new Map();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator > 0) properties.set(trimmed.slice(0, separator), trimmed.slice(separator + 1));
  }
  return properties;
};

/**
 * @param {string[]} coverageDirs workspace directories that define `test:coverage`
 * @param {Map<string, string>} properties parsed sonar-project.properties
 * @returns {string[]} one message per violation
 */
export const findSonarScopeViolations = (coverageDirs, properties, outOfScope = OUT_OF_SCOPE) => {
  const problems = [];
  const lists = {
    "sonar.sources": (dir) => dir,
    "sonar.tests": (dir) => dir,
    "sonar.javascript.lcov.reportPaths": (dir) => `${dir}/coverage/lcov.info`,
    "sonar.typescript.tsconfigPath": (dir) => `${dir}/tsconfig.json`,
  };

  for (const [dir, reason] of Object.entries(outOfScope)) {
    if (!reason.trim()) problems.push(`${dir} is out of Sonar scope without a reason in OUT_OF_SCOPE.`);
    if (!coverageDirs.includes(dir)) {
      problems.push(`${dir} is listed in OUT_OF_SCOPE but has no test:coverage script; drop the entry.`);
    }
  }

  for (const dir of coverageDirs) {
    const excluded = dir in outOfScope;
    for (const [key, entryFor] of Object.entries(lists)) {
      const present = listOf(properties, key).includes(entryFor(dir));
      if (!excluded && !present) {
        problems.push(`${dir} runs test:coverage but ${key} does not list ${entryFor(dir)}.`);
      }
      if (excluded && present) {
        problems.push(`${dir} is in OUT_OF_SCOPE but ${key} lists ${entryFor(dir)}.`);
      }
    }
  }
  return problems;
};

const workspaceDirs = () => {
  const globs = yaml.load(readFileSync(join(REPO_ROOT, "pnpm-workspace.yaml"), "utf8")).packages;
  const dirs = [];
  for (const pattern of globs) {
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      for (const entry of readdirSync(join(REPO_ROOT, prefix), { withFileTypes: true })) {
        if (entry.isDirectory()) dirs.push(`${prefix}/${entry.name}`);
      }
    } else {
      dirs.push(pattern);
    }
  }
  return dirs.filter((dir) => existsSync(join(REPO_ROOT, dir, "package.json"))).sort();
};

const main = () => {
  const coverageDirs = workspaceDirs().filter((dir) => {
    const manifest = JSON.parse(readFileSync(join(REPO_ROOT, dir, "package.json"), "utf8"));
    return Boolean(manifest.scripts?.["test:coverage"]);
  });
  const properties = parseProperties(readFileSync(join(REPO_ROOT, "sonar-project.properties"), "utf8"));
  const problems = findSonarScopeViolations(coverageDirs, properties);
  if (problems.length > 0) {
    console.error(`sonar-project.properties is out of step with the workspaces:\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`Sonar scope covers all ${coverageDirs.length} test:coverage workspaces.`);
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

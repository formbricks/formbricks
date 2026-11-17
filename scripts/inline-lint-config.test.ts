import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { type FixtureDiagnostic, lintFixtures } from "@formbricks/config-oxlint/testing";

/*
 * oxlint ignores ESLint's inline configuration comments, so a rule, environment or global set that way
 * configures nothing (an allowList in `/* eslint turbo/no-undeclared-env-vars: … *\/` silently stopped
 * applying in the oxlint migration). `formbricks/no-inline-lint-config` makes them a lint error in every
 * tier; disable directives, which oxlint honours, stay allowed.
 */

const RULE = "formbricks/no-inline-lint-config";
const root = fileURLToPath(new URL("..", import.meta.url));

const flagged: Record<string, string> = {
  "rule-config.ts":
    '/* eslint turbo/no-undeclared-env-vars: ["error", { "allowList": ["X"] }] */\nexport const a = 1;\n',
  "eslint-env.ts": "/* eslint-env node */\nexport const a = 1;\n",
  "global.ts": "/* global myGlobal */\nexport const a = 1;\n",
  "globals.ts": "/* globals myGlobal */\nexport const a = 1;\n",
  "no-space.ts": "/*eslint-env*/\nexport const a = 1;\n",
  "exported.ts": "/* exported a */\nexport const a = 1;\n",
};

const allowed: Record<string, string> = {
  "disable.ts": "/* eslint-disable no-console */\nexport const a = 1;\n",
  "disable-next-line.ts": "// eslint-disable-next-line no-console\nexport const a = 1;\n",
  "line-comment.ts":
    "// eslint turbo/no-undeclared-env-vars: off is not a config comment\nexport const a = 1;\n",
  "keyword-mid-comment.ts": "/* The eslint migration moved this to oxlint. */\nexport const a = 1;\n",
};

// One workspace per tier family: library (packages/types) and next (apps/web).
const workspaces = ["packages/types", "apps/web"];
const results = new Map<string, Record<string, FixtureDiagnostic[]>>();

const ruleHits = (workspace: string, file: string) =>
  results.get(workspace)![file].filter((diagnostic) => diagnostic.ruleId === RULE);

describe(RULE, () => {
  beforeAll(() => {
    for (const workspace of workspaces) {
      results.set(workspace, lintFixtures(`${root}${workspace}`, { ...flagged, ...allowed }));
    }
  }, 60_000);

  test.each(workspaces.flatMap((workspace) => Object.keys(flagged).map((file) => [workspace, file])))(
    "%s: reports %s",
    (workspace, file) => {
      expect(ruleHits(workspace, file)).toEqual([expect.objectContaining({ severity: "error", line: 1 })]);
    }
  );

  test.each(workspaces.flatMap((workspace) => Object.keys(allowed).map((file) => [workspace, file])))(
    "%s: allows %s",
    (workspace, file) => {
      expect(ruleHits(workspace, file)).toEqual([]);
    }
  );
});

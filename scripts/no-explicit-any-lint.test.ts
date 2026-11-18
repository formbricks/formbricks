import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { type FixtureDiagnostic, lintFixtures } from "@formbricks/config-oxlint/testing";

/*
 * `typescript/no-explicit-any` is an error in every tier that runs the typescript-eslint baseline
 * (ENG-7329). apps/web reached zero from 1,557 warnings, so a clean lint run cannot show the rule
 * still fires there; these fixtures, linted through each workspace's real config, do. The test file
 * matters on its own: most of apps/web's backlog was in tests.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const SOURCE = `export const parse = (value: any) => value;
`;

const cases = [
  {
    workspace: "apps/web",
    files: ["modules/no-explicit-any/parse.ts", "modules/no-explicit-any/parse.test.ts"],
  },
  { workspace: "packages/types", files: ["no-explicit-any/parse.ts"] },
  { workspace: "packages/survey-ui", files: ["src/no-explicit-any/parse.tsx"] },
];

const results = new Map<string, Record<string, FixtureDiagnostic[]>>();

describe("typescript/no-explicit-any is an error in each tier", () => {
  beforeAll(() => {
    for (const { workspace, files } of cases) {
      results.set(
        workspace,
        lintFixtures(`${root}${workspace}`, Object.fromEntries(files.map((file) => [file, SOURCE])))
      );
    }
  }, 60_000);

  test.each(cases.flatMap(({ workspace, files }) => files.map((file) => [workspace, file])))(
    "%s: %s",
    (workspace, file) => {
      const diagnostics = results.get(workspace)![file];
      expect(diagnostics, JSON.stringify(diagnostics)).toContainEqual(
        expect.objectContaining({ ruleId: "typescript/no-explicit-any", severity: "error" })
      );
    }
  );
});

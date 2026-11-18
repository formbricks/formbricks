import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { type FixtureDiagnostic, lintFixtures } from "@formbricks/config-oxlint/testing";

/*
 * `sonarjs/cognitive-complexity` sits at zero violations in the codebase, so a clean lint run cannot
 * show it still catches anything. A function over the threshold, linted through each tier's real
 * config with the Sonar-parity rules otherwise off (as `pnpm lint` runs), proves the whole-repo lint
 * reports it as an error. Test files stay exempt, as in Sonar.
 */

const root = fileURLToPath(new URL("..", import.meta.url));

// Cognitive complexity 21 against the threshold of 15.
const complexFunction = `export function complex(a: number[], b: boolean) {
  for (const x of a) {
    if (x > 1) {
      for (const y of a) {
        if (y > x) {
          while (b) {
            if (x && y) {
              b = !b;
            }
          }
        }
      }
    }
  }
}
`;

// One workspace per tier (next, library, react, react-hooks), the fixtures where each tier's
// tsconfig includes them.
const tiers = [
  { workspace: "apps/web", dir: "modules/cognitive-complexity" },
  { workspace: "packages/types", dir: "cognitive-complexity" },
  { workspace: "packages/survey-ui", dir: "src/cognitive-complexity" },
  { workspace: "packages/surveys", dir: "src/cognitive-complexity" },
];

const RULE = "sonarjs/cognitive-complexity";

const results = new Map<string, Record<string, FixtureDiagnostic[]>>();

describe("sonarjs/cognitive-complexity reports in the whole-repo lint", () => {
  beforeAll(() => {
    for (const { workspace, dir } of tiers) {
      results.set(
        workspace,
        lintFixtures(
          `${root}${workspace}`,
          { [`${dir}/complex.ts`]: complexFunction, [`${dir}/complex.test.ts`]: complexFunction },
          { env: { OXLINT_SONAR_PARITY: "off" } }
        )
      );
    }
  }, 120_000);

  test.each(tiers)("$workspace: a function over the threshold is an error", ({ workspace, dir }) => {
    const diagnostics = results.get(workspace)![`${dir}/complex.ts`];
    expect(diagnostics, JSON.stringify(diagnostics)).toContainEqual(
      expect.objectContaining({ ruleId: RULE, severity: "error" })
    );
  });

  test.each(tiers)("$workspace: test files are exempt", ({ workspace, dir }) => {
    const diagnostics = results.get(workspace)![`${dir}/complex.test.ts`];
    expect(diagnostics.filter((diagnostic) => diagnostic.ruleId === RULE)).toEqual([]);
  });
});

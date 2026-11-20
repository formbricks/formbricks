import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { TSX_UNIT_TEST_ALLOWLIST } from "@formbricks/config-oxlint/base";
import { type FixtureDiagnostic, lintFixtures } from "@formbricks/config-oxlint/testing";

/*
 * `formbricks/no-tsx-unit-test` enforces CODING_STANDARDS.md, Testing Guidelines: "Do not write
 * component or UI unit tests for `.tsx` files." A `*.test.tsx` / `*.spec.tsx` file fails lint, except
 * the tests that predate the check (`TSX_UNIT_TEST_ALLOWLIST` in packages/config-oxlint/base.mjs).
 */

const RULE = "formbricks/no-tsx-unit-test";
const root = fileURLToPath(new URL("..", import.meta.url));

const testSource = 'import { expect, test } from "vitest";\ntest("x", () => {\n  expect(1).toBe(1);\n});\n';

const banned = ["modules/widget/widget.test.tsx", "modules/widget/widget.spec.tsx", "lib/widget.test.jsx"];
const allowed = [
  "modules/widget/widget.test.ts",
  "modules/widget/use-widget.test.ts",
  "modules/widget/widget.tsx",
];

// One workspace per tier family that holds `.tsx`: next (apps/web) and react-hooks (packages/surveys).
const workspaces = ["apps/web", "packages/surveys"];
const results = new Map<string, Record<string, FixtureDiagnostic[]>>();
const hits = (workspace: string, file: string) =>
  results.get(workspace)![file].filter((diagnostic) => diagnostic.ruleId === RULE);

describe(RULE, () => {
  beforeAll(() => {
    for (const workspace of workspaces) {
      results.set(
        workspace,
        lintFixtures(
          `${root}${workspace}`,
          Object.fromEntries([...banned, ...allowed].map((file) => [file, testSource]))
        )
      );
    }
  }, 60_000);

  test.each(workspaces.flatMap((workspace) => banned.map((file) => [workspace, file])))(
    "%s: reports %s",
    (workspace, file) => {
      expect(hits(workspace, file)).toEqual([expect.objectContaining({ severity: "error", line: 1 })]);
    }
  );

  test.each(workspaces.flatMap((workspace) => allowed.map((file) => [workspace, file])))(
    "%s: allows %s",
    (workspace, file) => {
      expect(hits(workspace, file)).toEqual([]);
    }
  );

  // The allowlist only shrinks: adding a file means changing this snapshot, which a reviewer sees.
  test("the allowlist is frozen", () => {
    expect(TSX_UNIT_TEST_ALLOWLIST.toSorted()).toEqual([
      "apps/web/modules/auth/hooks/use-sign-out.test.tsx",
      "apps/web/modules/ee/analysis/charts/components/embedded-field-rename-button.test.tsx",
      "packages/surveys/src/components/general/survey.test.tsx",
      "packages/surveys/src/lib/use-focus-trap.test.tsx",
    ]);
  });

  // An entry whose test is gone is removed with it.
  test.each(TSX_UNIT_TEST_ALLOWLIST)("the allowlisted %s exists", (file) => {
    expect(existsSync(`${root}${file}`)).toBe(true);
  });

  test("the allowlisted tests pass the staged-file runner", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/lint-staged-oxlint.mjs", ...TSX_UNIT_TEST_ALLOWLIST],
      {
        cwd: root,
        encoding: "utf8",
      }
    );
    expect(`${result.stdout}${result.stderr}`).not.toContain(RULE);
    expect(result.status).toBe(0);
  }, 120_000);
});

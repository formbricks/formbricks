import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { type FixtureDiagnostic, lintFixtures } from "@formbricks/config-oxlint/testing";
import rootConfig from "../oxlint.config";

/*
 * Every tier runs oxlint's `correctness` and `suspicious` categories at "error" (ENG-7329). The rules
 * they turn on sit at zero, so a clean lint run cannot show they still report; one failing fixture per
 * category, linted through each tier's real config, does. The same run pins the category options the
 * repo tunes and one of the rules `base.mjs` turns off as clashing with a repo convention.
 */

const dirOf = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// One workspace per tier, plus the repo-tooling config.
const workspaces: Record<string, string> = {
  library: dirOf("../packages/logger/"),
  react: dirOf("../packages/survey-ui/"),
  "react-hooks": dirOf("../packages/surveys/"),
  next: dirOf("../apps/web/"),
  tooling: dirOf("./"),
};

const categoryFixtures: Record<string, { rule: string; source: string }> = {
  correctness: { rule: "no-caller", source: "export function f() {\n  return arguments.callee;\n}\n" },
  suspicious: {
    rule: "no-unneeded-ternary",
    source: "export const f = (a: number) => (a > 1 ? true : false);\n",
  },
};

const conventionFixtures = {
  // Vitest's `expect` takes a failure message, and a wrapped test takes its title from a variable.
  // Not named `*.test.ts`: oxlint's vitest rules apply to any file, and a test-named fixture inside a
  // workspace is collected by that workspace's vitest run when Turbo runs it alongside this one.
  "convention-vitest.ts": `import { expect, test } from "vitest";
const run = (title: string) => {
  test(title, () => {
    expect(1, "one is one").toBe(1);
  });
};
run("adds");
`,
  // The automatic JSX runtime needs no React in scope.
  "convention.tsx": "export const C = () => <div />;\n",
};

let results: Record<string, Record<string, FixtureDiagnostic[]>>;

describe("every tier runs oxlint's correctness and suspicious categories", () => {
  beforeAll(() => {
    results = Object.fromEntries(
      Object.entries(workspaces).map(([tier, dir]) => [
        tier,
        lintFixtures(dir, {
          ...Object.fromEntries(
            Object.entries(categoryFixtures).map(([category, { source }]) => [`${category}.ts`, source])
          ),
          ...conventionFixtures,
        }),
      ])
    );
    // Five oxlint runs, each loading its tier's JS plugins; well past vitest's 5s default.
  }, 120_000);

  describe.each(Object.keys(workspaces))("%s", (tier) => {
    test.each(Object.entries(categoryFixtures))("%s reports as an error", (category, { rule }) => {
      const diagnostics = results[tier][`${category}.ts`];
      expect(diagnostics, JSON.stringify(diagnostics)).toContainEqual(
        expect.objectContaining({ ruleId: rule, severity: "error" })
      );
    });

    test("a message to `expect`, a variable test title and JSX without React pass", () => {
      const diagnostics = [...results[tier]["convention-vitest.ts"], ...results[tier]["convention.tsx"]].map(
        (d) => d.ruleId
      );
      expect(diagnostics).not.toContain("vitest/valid-expect");
      expect(diagnostics).not.toContain("vitest/valid-title");
      expect(diagnostics).not.toContain("react/react-in-jsx-scope");
    });
  });
});

// oxlint takes `reportUnusedDisableDirectives` only from the root config, so a fixture cannot re-export
// it; its categories, which cover the root config files and docs/, are pinned directly.
test("the root config runs the same categories", () => {
  expect(rootConfig.categories).toEqual({ correctness: "error", suspicious: "error" });
});

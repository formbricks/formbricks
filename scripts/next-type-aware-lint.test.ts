import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { type FixtureDiagnostic, lintFixtures } from "@formbricks/config-oxlint/testing";

/*
 * apps/web runs the type-aware half of typescript-eslint's recommendedTypeChecked (ENG-7329). The rules
 * enforced there sit at zero, so a clean lint run cannot show they still report; one failing fixture
 * each, linted with type information through apps/web's real config, does. The rules still carrying a
 * backlog are `off` in apps/web/oxlint.config.ts and have no fixture here.
 */

const webDir = fileURLToPath(new URL("../apps/web/", import.meta.url));

const fixtures: Record<string, string> = {
  "typescript/await-thenable": "export async function f() {\n  return await 1;\n}\n",
  "typescript/no-array-delete": "export function f(a: number[]) {\n  delete a[0];\n}\n",
  "typescript/no-duplicate-type-constituents": "export type A = string | string;\n",
  "typescript/no-floating-promises": "export function f(g: () => Promise<void>) {\n  g();\n}\n",
  "typescript/no-for-in-array":
    "export function f(a: number[]) {\n  for (const i in a) {\n    console.log(i);\n  }\n}\n",
  "typescript/no-implied-eval": 'export function f() {\n  setTimeout("alert(1)", 1);\n}\n',
  "typescript/no-redundant-type-constituents": "export type A = unknown | string;\n",
  "typescript/no-unnecessary-type-assertion": "export const f = (a: string) => a as string;\n",
  "typescript/no-unsafe-unary-minus": "export const f = (a: string) => -(a as unknown as {});\n",
  "typescript/only-throw-error": 'export function f() {\n  throw "boom";\n}\n',
  "typescript/restrict-plus-operands": "export const f = (a: string, b: { x: 1 }) => a + b;\n",
  "typescript/restrict-template-expressions": "export const f = (a: { x: 1 }) => `${a}`;\n",
  "typescript/unbound-method":
    "class C {\n  m() {\n    return this;\n  }\n}\nexport const f = (c: C) => {\n  const { m } = c;\n  return m;\n};\n",
};

const fileFor = (rule: string) => `modules/next-type-aware/${rule.split("/")[1]}.ts`;
const TEST_FILE = "modules/next-type-aware/unbound-method.test.ts";

let results: Record<string, FixtureDiagnostic[]>;

describe("apps/web enforces the type-aware recommended rules", () => {
  beforeAll(() => {
    results = lintFixtures(
      webDir,
      {
        ...Object.fromEntries(Object.entries(fixtures).map(([rule, source]) => [fileFor(rule), source])),
        [TEST_FILE]: fixtures["typescript/unbound-method"],
      },
      { typeAware: true }
    );
    // Builds apps/web's TypeScript program once; well past vitest's 5s default.
  }, 180_000);

  test.each(Object.keys(fixtures))("%s reports as an error", (rule) => {
    const diagnostics = results[fileFor(rule)];
    expect(diagnostics, JSON.stringify(diagnostics)).toContainEqual(
      expect.objectContaining({ ruleId: rule, severity: "error" })
    );
  });

  test("unbound-method stays off in tests, where `expect(mock.fn)` passes methods unbound", () => {
    expect(results[TEST_FILE].map((d) => d.ruleId)).not.toContain("typescript/unbound-method");
  });
});

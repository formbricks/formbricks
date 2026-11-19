import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { type FixtureDiagnostic, lintFixtures } from "@formbricks/config-oxlint/testing";
import {
  eslintRecommended,
  typescriptFileOverrides,
  typescriptRecommended,
} from "../packages/config-oxlint/presets.mjs";

/*
 * apps/web ran the eslint/typescript-eslint recommended baselines as warnings while it worked off
 * their backlog (ENG-2264). Each is now at zero and an error. A clean lint run cannot show a rule
 * still fails, so the rules whose backlog was fixed get one failing fixture each, linted through
 * apps/web's real config (`typescript/no-explicit-any` in no-explicit-any-lint.test.ts), and the last
 * test pins the severity of the whole baseline.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const webDir = `${root}apps/web`;

const fixtures: Record<string, string> = {
  "prefer-const": "export function f() {\n  let a = 1;\n  return a;\n}\n",
  "no-unused-vars": "const unused = 1;\nexport {};\n",
  "typescript/no-unsafe-function-type": "export type F = Function;\n",
  "typescript/ban-ts-comment": "// @ts-ignore\nexport const a: number = 1;\n",
  "no-useless-catch":
    "export async function f(g: () => Promise<void>) {\n  try {\n    await g();\n  } catch (error) {\n    throw error;\n  }\n}\n",
  "no-unused-expressions": "export function f(a: boolean, g: () => void) {\n  a && g();\n}\n",
  "typescript/no-empty-object-type": "export interface A {}\n",
  "no-case-declarations":
    "export function f(x: number) {\n  switch (x) {\n    case 1:\n      const y = 2;\n      return y;\n  }\n  return 0;\n}\n",
  "typescript/no-wrapper-object-types": "export type A = Object;\n",
  "no-extra-boolean-cast": "export const f = (a: unknown) => (!!a ? 1 : 0);\n",
  "typescript/no-require-imports": 'const x = require("x");\nexport { x };\n',
  "no-prototype-builtins": 'export const f = (o: object) => o.hasOwnProperty("a");\n',
  "no-useless-escape": "export const r = /[\\+]/;\n",
  "typescript/no-non-null-asserted-optional-chain": "export const f = (o?: { a?: string }) => o?.a!;\n",
  "no-empty": "export function f(a: boolean) {\n  if (a) {\n  }\n}\n",
  "no-fallthrough":
    "export function f(x: number) {\n  let y = 0;\n  switch (x) {\n    case 1:\n      y = 1;\n    case 2:\n      y = 2;\n      break;\n  }\n  return y;\n}\n",
  "typescript/prefer-as-const": 'export const a = "a" as "a";\n',
  "no-var": "export var a = 1;\n",
  "no-control-regex": "export const r = /\\x00/;\n",
  "require-yield": "export function* g() {\n  return 1;\n}\n",
};

const fileFor = (rule: string) => `modules/next-baseline/${rule.replace("/", "-")}.ts`;

let results: Record<string, FixtureDiagnostic[]>;

const severityOf = (entry: unknown) => (Array.isArray(entry) ? entry[0] : entry);

const printConfig = () => {
  const { stdout, status, stderr } = spawnSync(
    process.execPath,
    [`${root}node_modules/oxlint/bin/oxlint`, "--print-config", "x.ts"],
    {
      cwd: webDir,
      encoding: "utf8",
      env: { ...process.env, NODE_OPTIONS: "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON" },
    }
  );
  expect(status, stderr).toBe(0);
  return JSON.parse(stdout) as {
    rules: Record<string, unknown>;
    overrides: { rules?: Record<string, unknown> }[];
  };
};

describe("apps/web enforces the recommended baselines as errors", () => {
  beforeAll(() => {
    results = lintFixtures(
      webDir,
      Object.fromEntries(Object.entries(fixtures).map(([rule, source]) => [fileFor(rule), source]))
    );
  }, 60_000);

  test.each(Object.keys(fixtures))("%s reports as an error", (rule) => {
    const diagnostics = results[fileFor(rule)];
    expect(diagnostics, JSON.stringify(diagnostics)).toContainEqual(
      expect.objectContaining({ ruleId: rule, severity: "error" })
    );
  });

  test("every other baseline rule is configured at error", () => {
    const { rules, overrides } = printConfig();
    for (const rule of Object.keys({ ...eslintRecommended, ...typescriptRecommended })) {
      expect(severityOf(rules[rule]), rule).toBe("deny");
    }
    // The TypeScript-file overrides switch some core rules off and add a few, at the preset's severity.
    const tsOverride = overrides.find((override) => override.rules && "prefer-const" in override.rules);
    for (const [rule, severity] of Object.entries(typescriptFileOverrides)) {
      expect(severityOf(tsOverride?.rules?.[rule]), rule).toBe(severity === "error" ? "deny" : "allow");
    }
    // Spawns oxlint, which loads the sonarjs plugin on every run: vitest's 5s default is too tight on CI.
  }, 30_000);
});

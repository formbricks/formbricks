import { spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

// Fixtures live beside real sources so the packages' own ESLint configs (type-aware, jsx-a11y)
// resolve them; they are written for the test and removed afterwards.
const typesFixture = "packages/types/src/sonar-parity-fixture.ts";
const typesTestFixture = "packages/types/src/sonar-parity-fixture.test.ts";
const uiFixture = "packages/survey-ui/src/sonar-parity-fixture.tsx";
const cleanFixture = "packages/types/src/sonar-parity-clean-fixture.ts";
const fixtures = [typesFixture, typesTestFixture, uiFixture, cleanFixture];

const complexFunction = `function complex(a: number[], b: boolean) {
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
}`;

const violations = `${complexFunction}

export const nestedConditional = (n: number) => (n > 1 ? "a" : n > 0 ? "b" : "c");
export const nestedTemplate = (s: string) => \`a \${\`b \${s}\`}\`;
export const windowsPath = "C:\\\\temp\\\\file";
export const optionalChain = (o?: { name?: string }) => o && o.name;
export const deep = () => () => () => () => () => 1;
`;

const staged = (...files: string[]) =>
  spawnSync(process.execPath, ["scripts/lint-staged-eslint.mjs", ...files], { cwd: root, encoding: "utf8" });

describe("Sonar-parity lint rules", () => {
  beforeAll(() => {
    writeFileSync(`${root}${typesFixture}`, violations);
    writeFileSync(
      `${root}${typesTestFixture}`,
      'import { expect, test } from "vitest";\ntest("x", () => { expect([1].length).toBe(1); });\n'
    );
    writeFileSync(`${root}${uiFixture}`, 'export const Fixture = () => <canvas aria-hidden="true" />;\n');
    writeFileSync(`${root}${cleanFixture}`, "export const clean = (n: number) => (n > 1 ? 1 : 0);\n");
  });

  afterAll(() => {
    for (const fixture of fixtures) if (existsSync(`${root}${fixture}`)) rmSync(`${root}${fixture}`);
  });

  test("the staged-file runner fails on each mirrored Sonar rule", () => {
    const result = staged(typesFixture, typesTestFixture, uiFixture);
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(1);
    for (const rule of [
      "sonarjs/cognitive-complexity",
      "sonarjs/no-nested-conditional",
      "sonarjs/no-nested-template-literals",
      "sonarjs/no-nested-functions",
      "unicorn/prefer-string-raw",
      "@typescript-eslint/prefer-optional-chain",
      "@vitest/prefer-to-have-length",
      "jsx-a11y/no-aria-hidden-on-focusable",
    ]) {
      expect(output, rule).toContain(rule);
    }
  }, 120_000);

  test("the staged-file runner passes a file without violations", () => {
    expect(staged(cleanFixture).status).toBe(0);
  }, 120_000);

  test("the whole-repo lint leaves the backlog rules off", () => {
    const { ESLINT_SONAR_PARITY: _ignored, ...env } = process.env;
    const result = spawnSync(
      process.execPath,
      [`${root}node_modules/eslint/bin/eslint.js`, "src/sonar-parity-fixture.ts"],
      { cwd: `${root}packages/types`, encoding: "utf8", env }
    );

    // The same file the staged run rejected: other rules may still report, the mirrored ones may not.
    const output = `${result.stdout}${result.stderr}`;
    expect(output).not.toMatch(/sonarjs\/|unicorn\/|prefer-optional-chain/);
  }, 120_000);
});

import { spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { lintFixtures } from "@formbricks/config-oxlint/testing";

const root = fileURLToPath(new URL("..", import.meta.url));

// Fixtures live beside real sources so the packages' own oxlint configs (type-aware, jsx-a11y)
// resolve them; they are written for the test and removed afterwards. `packages/types` keeps its
// sources at the package root (its tsconfig includes "."), `packages/survey-ui` under `src/`.
const typesFixture = "packages/types/sonar-parity-fixture.ts";
const typesTestFixture = "packages/types/sonar-parity-fixture.test.ts";
const uiFixture = "packages/survey-ui/src/sonar-parity-fixture.tsx";
const cleanFixture = "packages/types/sonar-parity-clean-fixture.ts";
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

const violations = `import { z } from "zod";

${complexFunction}

export const nestedConditional = (n: number) => (n > 1 ? "a" : n > 0 ? "b" : "c");
export const nestedTemplate = (s: string) => \`a \${\`b \${s}\`}\`;
export const windowsPath = "C:\\\\temp\\\\file";
export const optionalChain = (o?: { name?: string }) => o && o.name;
export const deep = () => () => () => () => () => 1;
export const isoTimestamp =
  /^(\\d{4})-(\\d{2})-(\\d{2})(?:T(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d{1,9})?)?(?:Z|[+-](?:[01]\\d|2[0-3]):[0-5]\\d))?$/;
export const nullish = (o?: { a: number }) => o || { a: 1 };
// zod 4 deprecates \`.finite()\`, a no-op there.
export const finiteNumber = z.number().finite();
`;

const testViolations =
  'import { expect, test } from "vitest";\ntest("x", () => { expect([1].length).toBe(1); });\n';
const focusableAriaHidden = 'export const Fixture = () => <button type="button" aria-hidden="true" />;\n';

const staged = (...files: string[]) =>
  spawnSync(process.execPath, ["scripts/lint-staged-oxlint.mjs", ...files], { cwd: root, encoding: "utf8" });

describe("Sonar-parity lint rules", () => {
  beforeAll(() => {
    writeFileSync(`${root}${typesFixture}`, violations);
    writeFileSync(`${root}${typesTestFixture}`, testViolations);
    writeFileSync(`${root}${uiFixture}`, focusableAriaHidden);
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
      "unicorn-js/prefer-string-raw",
      "typescript/prefer-optional-chain",
      "vitest/prefer-to-have-length",
      "jsx-a11y/no-aria-hidden-on-focusable",
    ]) {
      expect(output, rule).toContain(rule);
    }
  }, 120_000);

  test("the staged-file runner passes a file without violations", () => {
    expect(staged(cleanFixture).status).toBe(0);
  }, 120_000);

  // `oxlint --print-config` leaves JS-plugin rules out, so these lint the violations instead.
  const wholeRepoDiagnostics = (parity: string) =>
    lintFixtures(
      `${root}packages/types`,
      { "sonar-parity-fixture.ts": violations, "sonar-parity-fixture.test.ts": testViolations },
      { env: { OXLINT_SONAR_PARITY: parity }, typeAware: true }
    );

  // `sonarjs/cognitive-complexity` per tier and on test files: cognitive-complexity-lint.test.ts.
  test.each([
    "sonarjs/cognitive-complexity",
    "sonarjs/regex-complexity",
    "sonarjs/no-nested-functions",
    "sonarjs/no-nested-conditional",
    "sonarjs/no-nested-template-literals",
    "unicorn-js/prefer-string-raw",
    "typescript/prefer-optional-chain",
    "typescript/prefer-nullish-coalescing",
    "typescript/no-deprecated",
  ])(
    "the whole-repo lint reports %s as an error",
    (rule) => {
      const diagnostics = wholeRepoDiagnostics("off")["sonar-parity-fixture.ts"];
      expect(diagnostics, JSON.stringify(diagnostics)).toContainEqual(
        expect.objectContaining({ ruleId: rule, severity: "error" })
      );
    },
    120_000
  );

  test("the whole-repo lint reports vitest/prefer-to-have-length as an error", () => {
    const diagnostics = wholeRepoDiagnostics("off")["sonar-parity-fixture.test.ts"];
    expect(diagnostics, JSON.stringify(diagnostics)).toContainEqual(
      expect.objectContaining({ ruleId: "vitest/prefer-to-have-length", severity: "error" })
    );
  }, 120_000);

  test("apps/web reports jsx-a11y/no-aria-hidden-on-focusable as an error", () => {
    const file = "modules/sonar-parity/fixture.tsx";
    const diagnostics = lintFixtures(`${root}apps/web`, { [file]: focusableAriaHidden })[file];
    expect(diagnostics, JSON.stringify(diagnostics)).toContainEqual(
      expect.objectContaining({ ruleId: "jsx-a11y/no-aria-hidden-on-focusable", severity: "error" })
    );
  }, 60_000);
});

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

const violations = `${complexFunction}

export const nestedConditional = (n: number) => (n > 1 ? "a" : n > 0 ? "b" : "c");
export const nestedTemplate = (s: string) => \`a \${\`b \${s}\`}\`;
export const windowsPath = "C:\\\\temp\\\\file";
export const optionalChain = (o?: { name?: string }) => o && o.name;
export const deep = () => () => () => () => () => 1;
`;

const staged = (...files: string[]) =>
  spawnSync(process.execPath, ["scripts/lint-staged-oxlint.mjs", ...files], { cwd: root, encoding: "utf8" });

describe("Sonar-parity lint rules", () => {
  beforeAll(() => {
    writeFileSync(`${root}${typesFixture}`, violations);
    writeFileSync(
      `${root}${typesTestFixture}`,
      'import { expect, test } from "vitest";\ntest("x", () => { expect([1].length).toBe(1); });\n'
    );
    writeFileSync(
      `${root}${uiFixture}`,
      'export const Fixture = () => <button type="button" aria-hidden="true" />;\n'
    );
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

  test("the whole-repo lint leaves the backlog rules off", () => {
    const mirroredRules = [
      "sonarjs/cognitive-complexity",
      "sonarjs/no-nested-functions",
      "sonarjs/no-nested-conditional",
      "sonarjs/no-nested-template-literals",
      "unicorn-js/prefer-string-raw",
      "typescript/prefer-optional-chain",
    ];
    // `oxlint --print-config` leaves JS-plugin rules out, so this lints the violations instead. The
    // positive control below proves the same run reports them once the staged runner turns them on,
    // so an empty result means "off", not "the run failed".
    const reportedRules = (parity: string) =>
      new Set(
        lintFixtures(
          `${root}packages/types`,
          { "sonar-parity-fixture.ts": violations },
          { env: { OXLINT_SONAR_PARITY: parity }, typeAware: true }
        )["sonar-parity-fixture.ts"].map((diagnostic) => diagnostic.ruleId)
      );

    const staged = reportedRules("error");
    for (const rule of mirroredRules) expect(staged.has(rule), `${rule} (staged)`).toBe(true);

    const wholeRepo = reportedRules("off");
    for (const rule of mirroredRules) expect(wholeRepo.has(rule), rule).toBe(false);
  }, 120_000);
});

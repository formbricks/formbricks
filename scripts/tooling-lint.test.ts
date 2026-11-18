import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { type FixtureDiagnostic, lintFixtures } from "@formbricks/config-oxlint/testing";

/*
 * Repo tooling (the root `scripts/`, `.github/` and the `config-*` packages) lints against
 * `scripts/oxlint.config.ts`, the library tier without type information. Before it, no rule ran on
 * these files, so one failing fixture per workspace proves each config resolves and reports errors.
 */

const root = fileURLToPath(new URL("..", import.meta.url));

const ruleIds = (diagnostics: FixtureDiagnostic[], severity: string) =>
  diagnostics.filter((diagnostic) => diagnostic.severity === severity).map((diagnostic) => diagnostic.ruleId);

const ENV_READ = "export const token = process.env.SOME_TOKEN;\n";

describe("repo tooling lints against the untyped library tier", () => {
  test.each(["scripts", ".github", "packages/config-oxlint", "packages/config-prettier"])(
    "%s: an unused variable is an error",
    (workspace) => {
      const file = "fixture.mjs";
      const diagnostics = lintFixtures(`${root}${workspace}`, { [file]: "const unused = 1;\nexport {};\n" })[
        file
      ];
      expect(ruleIds(diagnostics, "error"), JSON.stringify(diagnostics)).toContain("no-unused-vars");
    },
    30_000
  );

  test("tests use `test`, not `it`", () => {
    const file = "fixture.test.ts";
    const diagnostics = lintFixtures(`${root}scripts`, {
      [file]: 'import { it } from "vitest";\nit("x", () => {});\n',
    })[file];
    expect(ruleIds(diagnostics, "error"), JSON.stringify(diagnostics)).toContain("vitest/consistent-test-it");
  }, 30_000);

  test("env reads are not Turbo task inputs there, unlike in a workspace package", () => {
    const file = "fixture.ts";
    // Positive control: the same read fails in a package, so a clean result below means "off".
    const inPackage = lintFixtures(`${root}packages/types`, { [file]: ENV_READ })[file];
    expect(ruleIds(inPackage, "error")).toContain("turbo/no-undeclared-env-vars");

    const inScripts = lintFixtures(`${root}scripts`, { [file]: ENV_READ })[file];
    expect(inScripts.map((diagnostic) => diagnostic.ruleId)).not.toContain("turbo/no-undeclared-env-vars");
  }, 30_000);
});

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { OxlintConfig } from "oxlint";
import { describe, expect, test } from "vitest";
import { STAGED_LINES_RULE_IDS } from "@formbricks/config-oxlint/sonar-parity";
// Not a package export: the workspaces use the `base.mjs` wrapper, which fixes `except`.
import { raiseWarnings } from "../packages/config-oxlint/compose.mjs";

/*
 * oxlint runs once for the whole repo, and a warning does not fail the run. Every workspace config
 * therefore wraps its export in `denyWarnings` (packages/config-oxlint/base.mjs), so a warning fails
 * `pnpm lint:code` and CI like an error (ENG-7401). This imports each `oxlint.config.ts` and fails on
 * any category or rule its default export leaves at "warn", so a new workspace or a new "warn" outside
 * the wrapper is caught. The staged-lines Sonar-parity rules are the exception the wrapper keeps.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const staged = new Set(STAGED_LINES_RULE_IDS);

type Rules = OxlintConfig["rules"];

const isWarn = (entry: unknown) => (Array.isArray(entry) ? entry[0] : entry) === "warn";

const warnRules = (rules: Rules = {}) =>
  Object.entries(rules)
    .filter(([id, entry]) => isWarn(entry) && !staged.has(id))
    .map(([id]) => id);

const warnings = (config: OxlintConfig) => [
  ...Object.entries(config.categories ?? {})
    .filter(([, severity]) => isWarn(severity))
    .map(([name]) => `category ${name}`),
  ...warnRules(config.rules),
  ...(config.overrides ?? []).flatMap((override) =>
    warnRules(override.rules).map((id) => `${id} (override for ${override.files.join(", ")})`)
  ),
];

const configPaths = execFileSync("git", ["ls-files", "oxlint.config.ts", "**/oxlint.config.ts"], {
  cwd: root,
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

describe("no workspace lints with a warning", () => {
  test("finds the workspace configs", () => {
    expect(configPaths).toEqual(
      expect.arrayContaining([
        "oxlint.config.ts",
        "apps/web/oxlint.config.ts",
        "packages/surveys/oxlint.config.ts",
      ])
    );
  });

  test.each(configPaths)(
    "%s sets nothing to warn",
    async (configPath) => {
      const { default: config } = (await import(`${root}${configPath}`)) as { default: OxlintConfig };
      expect(warnings(config)).toEqual([]);
    },
    30_000
  );
});

describe("raiseWarnings", () => {
  test("raises warn to error in categories, rules and overrides, keeping options", () => {
    const config = raiseWarnings({
      categories: { correctness: "error", pedantic: "warn" },
      rules: { a: "warn", b: ["warn", { max: 1 }], c: "off", d: "error" },
      overrides: [{ files: ["*.ts"], rules: { e: "warn" } }],
    });
    expect(config.categories).toEqual({ correctness: "error", pedantic: "error" });
    expect(config.rules).toEqual({ a: "error", b: ["error", { max: 1 }], c: "off", d: "error" });
    expect(config.overrides).toEqual([{ files: ["*.ts"], rules: { e: "error" } }]);
  });

  test("keeps warn on the rules it is told to except", () => {
    const config = raiseWarnings(
      {
        rules: { staged: "warn", other: "warn" },
        overrides: [{ files: ["*.ts"], rules: { staged: "warn" } }],
      },
      { except: ["staged"] }
    );
    expect(config.rules).toEqual({ staged: "warn", other: "error" });
    expect(config.overrides).toEqual([{ files: ["*.ts"], rules: { staged: "warn" } }]);
  });
});

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { denyWarnings as raiseWarnings } from "../packages/config-oxlint/compose.mjs";
import { STAGED_LINES_RULE_IDS } from "../packages/config-oxlint/sonar-parity.mjs";

/*
 * oxlint runs once for the whole repo, and a warning does not fail the run. Every workspace config
 * therefore wraps its export in `denyWarnings` (packages/config-oxlint/base.mjs), so a warning fails
 * `pnpm lint:code` and CI like an error (ENG-7401). This reads each config as oxlint loads it and
 * fails on any rule left at "warn", so a new workspace or a new "warn" outside the wrapper is caught.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const staged = new Set(STAGED_LINES_RULE_IDS);

type Entry = unknown;
interface Config {
  categories?: Record<string, Entry>;
  rules?: Record<string, Entry>;
  overrides?: { files: string[]; rules?: Record<string, Entry> }[];
}

const severityOf = (entry: Entry) => (Array.isArray(entry) ? entry[0] : entry);

const warnings = (config: Config) => [
  ...Object.entries(config.categories ?? {})
    .filter(([, severity]) => severity === "warn")
    .map(([name]) => `category ${name}`),
  ...Object.entries(config.rules ?? {})
    .filter(([id, entry]) => severityOf(entry) === "warn" && !staged.has(id))
    .map(([id]) => id),
  ...(config.overrides ?? []).flatMap((override) =>
    Object.entries(override.rules ?? {})
      .filter(([id, entry]) => severityOf(entry) === "warn" && !staged.has(id))
      .map(([id]) => `${id} (override for ${override.files.join(", ")})`)
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
    "%s sets no rule to warn",
    async (configPath) => {
      const { default: config } = (await import(`${root}${configPath}`)) as { default: Config };
      expect(warnings(config)).toEqual([]);
    },
    30_000
  );
});

describe("denyWarnings", () => {
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

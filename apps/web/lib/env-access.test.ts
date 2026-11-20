import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { type FixtureDiagnostic, lintFixtures } from "@formbricks/config-oxlint/testing";

// Guards the ENG-1685 lint rule in oxlint.config.ts. The rule is the only thing keeping direct
// `process.env` access from growing back alongside the validated env module, and a config
// regression is silent: if the selectors or the exempt-file globs stop matching, lint still passes
// and nothing else notices.

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const RULE = "formbricks/restricted-syntax";
const READ = "export const a = process.env.DATABASE_URL;";

const flaggedSpellings: [string, string][] = [
  ["static access", READ],
  ["string-key access", 'export const a = process.env["DATABASE_URL"];'],
  ["dynamic-key access", "export const a = (key: string) => process.env[key];"],
  ["spreading the whole object", "export const a = { ...process.env };"],
  ["destructuring the whole object", "export const { DATABASE_URL } = process.env;"],
  ["aliasing the whole object", "export const a = process.env;"],
  // `env` spelled as a computed key bypasses every selector that keys off it being an
  // identifier, so it has to be covered explicitly.
  ["string-keyed env access", 'export const a = process["env"].DATABASE_URL;'],
  ["string-keyed bare env", 'export const a = process["env"];'],
  ["template-keyed env access", "export const a = process[`env`].DATABASE_URL;"],
  ["dynamic-key access on process", "export const a = (key: string) => process[key];"],
];

const exemptFiles = [
  "lib/env.ts",
  "next.config.mjs",
  "instrumentation.ts",
  "instrumentation-node.ts",
  "sentry.server.config.ts",
  "scripts/example.ts",
  "integration/example.ts",
  "modules/example/service.test.ts",
  "modules/example/__mocks__/service.ts",
];

const frameworkInjected = ["NEXT_RUNTIME", "NEXT_PHASE"];

const spellingFile = (index: number) => `modules/example/spelling-${index}.ts`;

let results: Record<string, FixtureDiagnostic[]>;

// Severity is part of what is asserted, not incidental: a rule turned off, or left at "warn" outside
// the config's `denyWarnings` wrapper, would leave the config looking intact while letting every
// violation through. Matching only errors makes either fail the suite.
const lintErrors = (file: string): string[] =>
  results[file].filter((d) => d.ruleId === RULE && d.severity === "error").map((d) => d.message);

describe("direct process.env access is linted (ENG-1685)", () => {
  beforeAll(() => {
    // One oxlint run for every case: each file sits at its own path in a throwaway directory that
    // uses apps/web's real config, so the exempt-file globs are exercised as written.
    results = lintFixtures(appDir, {
      ...Object.fromEntries(flaggedSpellings.map(([, source], index) => [spellingFile(index), source])),
      "modules/example/argv.ts": "export const a = process.argv;",
      ...Object.fromEntries(
        frameworkInjected.map((name) => [
          `modules/example/${name}.ts`,
          `export const a = process.env.${name};`,
        ])
      ),
      "modules/example/node-env.ts": "export const a = process.env.NODE_ENV;",
      ...Object.fromEntries(exemptFiles.map((file) => [file, READ])),
    });
  }, 30_000);

  test.each(flaggedSpellings.map(([label], index) => [label, index] as const))(
    "flags %s in application code",
    (_label, index) => {
      expect(lintErrors(spellingFile(index))).toHaveLength(1);
    }
  );

  test("leaves non-env process members alone", () => {
    expect(lintErrors("modules/example/argv.ts")).toEqual([]);
  });

  test.each(frameworkInjected)("allows %s, which Next.js injects and the schema cannot validate", (name) => {
    expect(lintErrors(`modules/example/${name}.ts`)).toEqual([]);
  });

  test("flags NODE_ENV, which belongs to the schema", () => {
    expect(lintErrors("modules/example/node-env.ts")).toHaveLength(1);
  });

  test.each(exemptFiles)("exempts %s", (relativeFilePath) => {
    expect(lintErrors(relativeFilePath)).toEqual([]);
  });

  test("points contributors at the env module", () => {
    const [message] = lintErrors(spellingFile(0));
    expect(message).toContain("@/lib/env");
    expect(message).toContain("@/lib/env-client");
  });
});

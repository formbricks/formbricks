import { ESLint } from "eslint";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";

// Guards the ENG-1685 lint rule in eslint.config.mjs. The rule is the only thing keeping direct
// `process.env` access from growing back alongside the validated env module, and a config
// regression is silent: if the selectors or the exempt-file globs stop matching, lint still passes
// and nothing else notices.

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let eslint: ESLint;

const lintErrors = async (source: string, relativeFilePath: string): Promise<string[]> => {
  const [result] = await eslint.lintText(source, { filePath: path.join(appDir, relativeFilePath) });
  return result.messages.filter((message) => message.ruleId === "no-restricted-syntax").map((m) => m.message);
};

describe("direct process.env access is linted (ENG-1685)", () => {
  beforeAll(() => {
    eslint = new ESLint({ cwd: appDir });
  });

  test.each([
    ["static access", "export const a = process.env.DATABASE_URL;"],
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
  ])("flags %s in application code", async (_label, source) => {
    expect(await lintErrors(source, "modules/example/service.ts")).toHaveLength(1);
  });

  test("leaves non-env process members alone", async () => {
    expect(await lintErrors("export const a = process.argv;", "modules/example/service.ts")).toEqual([]);
  });

  test.each(["NEXT_RUNTIME", "NEXT_PHASE"])(
    "allows %s, which Next.js injects and the schema cannot validate",
    async (name) => {
      expect(await lintErrors(`export const a = process.env.${name};`, "modules/example/service.ts")).toEqual(
        []
      );
    }
  );

  test("flags NODE_ENV, which belongs to the schema", async () => {
    const errors = await lintErrors("export const a = process.env.NODE_ENV;", "modules/example/service.ts");
    expect(errors).toHaveLength(1);
  });

  test.each([
    "lib/env.ts",
    "next.config.mjs",
    "instrumentation.ts",
    "instrumentation-node.ts",
    "sentry.server.config.ts",
    "scripts/example.ts",
    "integration/example.ts",
    "modules/example/service.test.ts",
    "modules/example/__mocks__/service.ts",
  ])("exempts %s", async (relativeFilePath) => {
    expect(await lintErrors("export const a = process.env.DATABASE_URL;", relativeFilePath)).toEqual([]);
  });

  test("points contributors at the env module", async () => {
    const [message] = await lintErrors(
      "export const a = process.env.DATABASE_URL;",
      "modules/example/service.ts"
    );
    expect(message).toContain("@/lib/env");
    expect(message).toContain("@/lib/env-client");
  });
});

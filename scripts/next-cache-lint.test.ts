import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";

const eslint = new ESLint({ cwd: fileURLToPath(new URL("../apps/web/", import.meta.url)) });

const importErrors = async (source: string, filePath = "lib/cache-convention.ts") => {
  const [result] = await eslint.lintText(source, { filePath });
  expect(result.fatalErrorCount).toBe(0);
  return result.messages.filter((message) => message.ruleId === "no-restricted-imports");
};

describe("Next cache import convention in the web ESLint config", () => {
  beforeAll(async () => {
    // ESLint loads the full web config and plugins lazily. Give that one-time setup its own
    // budget when Turbo runs this suite alongside workspace builds on a cold CI runner.
    await eslint.lintText("", { filePath: "lib/cache-convention.ts" });
  }, 30_000);

  test.each([
    'import { unstable_cache } from "next/cache";',
    'import { unstable_cache as cached } from "next/cache";',
    'export { unstable_cache as cached } from "next/cache";',
    'import * as nextCache from "next/cache";',
  ])("rejects the banned API: %s", async (source) => {
    expect(await importErrors(source)).toEqual([expect.objectContaining({ severity: 2 })]);
  });

  test("also enforces the restriction in tests excluded from the schema import rule", async () => {
    expect(
      await importErrors('import { unstable_cache } from "next/cache";', "lib/cache-convention.test.ts")
    ).toEqual([expect.objectContaining({ severity: 2 })]);
  });

  test("permits supported caching and revalidation APIs", async () => {
    expect(
      await importErrors('import { revalidatePath } from "next/cache";\nimport { cache } from "react";')
    ).toEqual([]);
  });

  test("retains the existing test-only schema boundary", async () => {
    expect(await importErrors('import { fixture } from "@formbricks/api-v3-schemas/testing";')).toEqual([
      expect.objectContaining({ severity: 2 }),
    ]);
    expect(
      await importErrors(
        'import { fixture } from "@formbricks/api-v3-schemas/testing";',
        "lib/schema.test.ts"
      )
    ).toEqual([]);
  });
});

import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { type FixtureDiagnostic, lintFixtures } from "@formbricks/config-oxlint/testing";

const webDir = fileURLToPath(new URL("../apps/web/", import.meta.url));

const bannedImports = [
  'import { unstable_cache } from "next/cache";',
  'import { unstable_cache as cached } from "next/cache";',
  'export { unstable_cache as cached } from "next/cache";',
  'import * as nextCache from "next/cache";',
];

const fixtures: Record<string, string> = {
  ...Object.fromEntries(bannedImports.map((source, index) => [`lib/banned-${index}.ts`, source])),
  "lib/cache-convention.test.ts": 'import { unstable_cache } from "next/cache";',
  "lib/supported.ts": 'import { revalidatePath } from "next/cache";\nimport { cache } from "react";',
  "lib/schema.ts": 'import { fixture } from "@formbricks/api-v3-schemas/testing";',
  "lib/schema.test.ts": 'import { fixture } from "@formbricks/api-v3-schemas/testing";',
};

let results: Record<string, FixtureDiagnostic[]>;

const importErrors = (file: string) => results[file].filter((d) => d.ruleId === "no-restricted-imports");

describe("Next cache import convention in the web oxlint config", () => {
  beforeAll(() => {
    // One oxlint run for every case, through apps/web's real config.
    results = lintFixtures(webDir, fixtures);
  }, 30_000);

  test.each(bannedImports.map((source, index) => [source, index] as const))(
    "rejects the banned API: %s",
    (_source, index) => {
      expect(importErrors(`lib/banned-${index}.ts`)).toEqual([
        expect.objectContaining({ severity: "error" }),
      ]);
    }
  );

  test("also enforces the restriction in tests excluded from the schema import rule", () => {
    expect(importErrors("lib/cache-convention.test.ts")).toEqual([
      expect.objectContaining({ severity: "error" }),
    ]);
  });

  test("permits supported caching and revalidation APIs", () => {
    expect(importErrors("lib/supported.ts")).toEqual([]);
  });

  test("retains the existing test-only schema boundary", () => {
    expect(importErrors("lib/schema.ts")).toEqual([expect.objectContaining({ severity: "error" })]);
    expect(importErrors("lib/schema.test.ts")).toEqual([]);
  });
});

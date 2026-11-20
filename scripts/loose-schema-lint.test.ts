import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { LOOSE_SCHEMA_ALLOWLIST } from "@formbricks/config-oxlint/base";
import { type FixtureDiagnostic, lintFixtures } from "@formbricks/config-oxlint/testing";

/*
 * `formbricks/no-loose-schema` (ENG-7450, ENG-7127's class): a zod schema that keeps unknown keys,
 * flagged where it is declared, outside the files in `LOOSE_SCHEMA_ALLOWLIST`
 * (packages/config-oxlint/base.mjs). The rule sits in `base.mjs`, which every tier shares.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const RULE = "formbricks/no-loose-schema";
const header = 'import { z } from "zod";\n';

// Each reports `RULE` once.
const banned: Record<string, string> = {
  "passthrough.ts": `${header}export const S = z.object({ name: z.string() }).passthrough();\n`,
  "loose.ts": `${header}export const S = z.object({ name: z.string() }).loose();\n`,
  "loose-object.ts": `${header}export const S = z.looseObject({ name: z.string() });\n`,
  "catchall.ts": `${header}export const S = z.object({ name: z.string() }).catchall(z.unknown());\n`,
};

const allowed: Record<string, string> = {
  "strict.ts": `${header}export const S = z.object({ name: z.string() }).strict();\n`,
  "plain-object.ts": `${header}export const S = z.object({ name: z.string() });\n`,
  "catchall-never.ts": `${header}export const S = z.object({ name: z.string() }).catchall(z.never());\n`,
  // A path in the allowlist, as the fixture helper nests it under the workspace.
  "apps/web/modules/mcp/tools/output-schemas.ts": `${header}export const S = z.looseObject({});\n`,
};

let results: Record<string, FixtureDiagnostic[]>;
const hits = (file: string) => results[file].filter((diagnostic) => diagnostic.ruleId === RULE);

describe(RULE, () => {
  beforeAll(() => {
    results = lintFixtures(`${root}apps/web`, { ...banned, ...allowed });
  }, 120_000);

  test.each(Object.keys(banned))("reports %s", (file) => {
    expect(hits(file)).toEqual([expect.objectContaining({ severity: "error" })]);
  });

  test.each(Object.keys(allowed))("allows %s", (file) => {
    expect(hits(file)).toEqual([]);
  });

  // The allowlist only shrinks: adding a file means changing this snapshot, which a reviewer sees.
  test("the allowlist is frozen", () => {
    expect(Object.keys(LOOSE_SCHEMA_ALLOWLIST).toSorted()).toEqual([
      "apps/web/app/api/v3/lib/bounded-parse.test.ts",
      "apps/web/modules/custom-css/lib/service.ts",
      "apps/web/modules/mcp/tools/output-schemas.ts",
      "apps/web/modules/mcp/tools/response-schemas.ts",
      "apps/web/modules/mcp/tools/survey-output-schemas.ts",
      "apps/web/modules/mcp/tools/tag-output-schemas.ts",
      "packages/workflows/src/handlers/run-detail.ts",
    ]);
  });

  test.each(Object.entries(LOOSE_SCHEMA_ALLOWLIST))(
    "the allowlisted %s exists and has a reason",
    (file, reason) => {
      expect(existsSync(`${root}${file}`)).toBe(true);
      expect(reason.trim()).not.toBe("");
    }
  );
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { type FixtureDiagnostic, lintFixtures } from "@formbricks/config-oxlint/testing";
import { BASELINED_RULES, baselineFromDiagnostics, staleEntries } from "./formbricks-rules-baseline.mjs";

/*
 * Which apps/web files each formbricks/* rule (ENG-7325) reaches through apps/web/oxlint.config.ts, and that
 * the per-file baseline grandfathers exactly the files it lists. The rules themselves are tested in
 * formbricks-lint-rules.test.ts.
 */

const webDir = fileURLToPath(new URL("../apps/web/", import.meta.url));
const baseline: Record<string, string[]> = JSON.parse(
  readFileSync(new URL("../apps/web/formbricks-rules-baseline.json", import.meta.url), "utf8")
);

const TENANT = "prisma.survey.findUnique({ where: { id } });\n";
const LOG =
  'import { logger } from "@formbricks/logger";\nexport const f = (error: unknown) => logger.error({ err: error }, "x");\n';
const LOOSE = 'import { z } from "zod";\nexport const s = z.object({});\n';
const ROLE = 'export const ok = (role: string) => role === "owner";\n';
const DELETE = "tx.survey.delete({ where: { id } });\n";
const WRITER = 'import { AsyncParser } from "@json2csv/node";\nexport const p = AsyncParser;\n';
const UPLOAD = "export const r = (request: Request) => request.formData();\n";
const DISPOSITION = 'export const h = { "Content-Disposition": "attachment" };\n';

// [rule, source, workspace-relative path, expected hits]. Paths are fixtures, chosen outside the baseline.
const cases: [string, string, string, number][] = [
  ["tenant-scoped-where", TENANT, "lib/fixture/tenant.ts", 1],
  ["tenant-scoped-where", TENANT, "app/api/v3/fixture/route.ts", 1],
  ["tenant-scoped-where", TENANT, "modules/fixture/actions.ts", 1],
  ["tenant-scoped-where", TENANT, "lib/fixture/tenant.test.ts", 0],
  ["tenant-scoped-where", TENANT, "modules/ui/components/fixture.tsx", 0],
  ["loggable-error", LOG, "modules/fixture/log.ts", 1],
  ["loggable-error", LOG, "modules/fixture/log.test.ts", 0],
  ["strict-input-object", LOOSE, "app/api/v3/fixture/schemas.ts", 1],
  ["strict-input-object", LOOSE, "app/api/internal/fixture/schemas.ts", 1],
  ["strict-input-object", LOOSE, "modules/mcp/tools/fixture.ts", 1],
  ["strict-input-object", LOOSE, "modules/fixture/lib/schema.ts", 0],
  ["gate-predicate", ROLE, "modules/fixture/lib/role.ts", 1],
  ["gate-predicate", ROLE, "lib/membership/utils.ts", 0],
  ["deletion-service", DELETE, "modules/fixture/lib/delete.ts", 1],
  ["deletion-service", DELETE, "modules/survey/lib/surveys.ts", 0],
  ["spreadsheet-writer", WRITER, "modules/fixture/export.ts", 1],
  ["spreadsheet-writer", WRITER, "lib/utils/file-conversion.ts", 0],
  ["raw-upload-read", UPLOAD, "app/api/fixture/route.ts", 1],
  ["raw-upload-read", UPLOAD, "app/lib/api/request-body.ts", 0],
  ["content-disposition-helper", DISPOSITION, "app/api/fixture/download/route.ts", 1],
  ["content-disposition-helper", DISPOSITION, "lib/utils/content-disposition.ts", 0],
];

// A grandfathered file under a `[param]` / `(group)` route, to prove the baseline's globs are escaped.
const grandfathered = baseline["formbricks/loggable-error"].find((file) => /[[(]/.test(file));

let results: Record<string, FixtureDiagnostic[]>;
const hits = (file: string, rule: string) =>
  results[file].filter((diagnostic) => diagnostic.ruleId === `formbricks/${rule}`);

describe("formbricks/* rules in the apps/web oxlint config", () => {
  beforeAll(() => {
    const files = Object.fromEntries(cases.map(([, source, file]) => [file, source]));
    if (grandfathered) files[grandfathered] = LOG;
    files["modules/fixture/neighbour/log.ts"] = LOG;
    results = lintFixtures(webDir, files);
  }, 60_000);

  test.each(cases)("%s in %s… reaches %s: %i", (rule, _source, file, expected) => {
    const found = hits(file, rule);
    expect(found).toHaveLength(expected);
    for (const diagnostic of found) expect(diagnostic.severity).toBe("error");
  });

  test("a baselined file is grandfathered for its rule only, and its path is matched literally", () => {
    expect(grandfathered).toBeDefined();
    expect(hits(grandfathered!, "loggable-error")).toEqual([]);
    expect(hits("modules/fixture/neighbour/log.ts", "loggable-error")).toHaveLength(1);
  });

  test("the baseline names only the rules it covers", () => {
    for (const rule of Object.keys(baseline)) expect(BASELINED_RULES).toContain(rule);
  });
});

describe("formbricks-rules-baseline.mjs", () => {
  const diagnostic = (code: string, filename: string) => ({ code, filename });

  test("groups files per rule, sorted and de-duplicated, ignoring other rules", () => {
    expect(
      baselineFromDiagnostics([
        diagnostic("formbricks(loggable-error)", "lib/b.ts"),
        diagnostic("formbricks(loggable-error)", "lib/a.ts"),
        diagnostic("formbricks(loggable-error)", "lib/b.ts"),
        diagnostic("formbricks(restricted-syntax)", "lib/c.ts"),
        diagnostic("eslint(no-unused-vars)", "lib/d.ts"),
      ])
    ).toEqual({ "formbricks/loggable-error": ["lib/a.ts", "lib/b.ts"] });
  });

  test("reports entries whose file no longer breaks the rule", () => {
    const committed = {
      "formbricks/loggable-error": ["lib/a.ts", "lib/b.ts"],
      "formbricks/gate-predicate": ["x.ts"],
    };
    const current = { "formbricks/loggable-error": ["lib/a.ts"] };
    expect(staleEntries(committed, current)).toEqual([
      "formbricks/loggable-error  lib/b.ts",
      "formbricks/gate-predicate  x.ts",
    ]);
  });
});

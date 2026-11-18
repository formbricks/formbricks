import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";

// Which apps/web files each formbricks/* rule reaches. The rules themselves are tested in
// formbricks-eslint-rules.test.ts; this pins the scoping and the exempt files in apps/web/eslint.config.mjs.
// The Node API never applies eslint-suppressions.json (only the CLI does), so a committed baseline cannot
// hide a scoping gap here.
const eslint = new ESLint({ cwd: fileURLToPath(new URL("../apps/web/", import.meta.url)) });

const ruleHits = async (source: string, filePath: string, ruleId: string) => {
  const [result] = await eslint.lintText(source, { filePath });
  expect(result.fatalErrorCount).toBe(0);
  return result.messages.filter((message) => message.ruleId === `formbricks/${ruleId}`).length;
};

describe("formbricks/* rules in the web ESLint config", () => {
  beforeAll(async () => {
    // The full web config loads its plugins lazily; give that one-time cost its own budget.
    await eslint.lintText("", { filePath: "lib/warmup.ts" });
  }, 30_000);

  test.each([
    ["tenant-scoped-where", "prisma.survey.findUnique({ where: { id } });", "lib/survey/service.ts", 1],
    ["tenant-scoped-where", "prisma.survey.findUnique({ where: { id } });", "app/api/v3/x/route.ts", 1],
    [
      "tenant-scoped-where",
      "prisma.survey.findUnique({ where: { id } });",
      "modules/survey/editor/actions.ts",
      1,
    ],
    ["tenant-scoped-where", "prisma.survey.findUnique({ where: { id } });", "lib/survey/service.test.ts", 0],
    ["tenant-scoped-where", "prisma.survey.findUnique({ where: { id } });", "modules/ui/components/x.tsx", 0],
    ["loggable-error", 'logger.error({ err: error }, "x");', "modules/survey/x.ts", 1],
    ["loggable-error", 'logger.error({ err: error }, "x");', "modules/survey/x.test.ts", 0],
    ["strict-input-object", "export const s = z.object({});", "app/api/v3/surveys/schemas.ts", 1],
    ["strict-input-object", "export const s = z.object({});", "app/api/internal/surveys/schemas.ts", 1],
    ["strict-input-object", "export const s = z.object({});", "modules/mcp/tools/surveys.ts", 1],
    ["strict-input-object", "export const s = z.object({});", "modules/survey/editor/lib/schema.ts", 0],
    ["gate-predicate", 'export const ok = (role: string) => role === "owner";', "modules/x/lib/y.ts", 1],
    ["gate-predicate", 'export const ok = (role: string) => role === "owner";', "lib/membership/utils.ts", 0],
    ["deletion-service", "tx.survey.delete({ where: { id } });", "modules/survey/editor/lib/x.ts", 1],
    ["deletion-service", "tx.survey.delete({ where: { id } });", "modules/survey/lib/surveys.ts", 0],
    ["spreadsheet-writer", 'import { AsyncParser } from "@json2csv/node";', "modules/x/export.ts", 1],
    [
      "spreadsheet-writer",
      'import { AsyncParser } from "@json2csv/node";',
      "lib/utils/file-conversion.ts",
      0,
    ],
    [
      "raw-upload-read",
      "export const r = (request: Request) => request.formData();",
      "app/api/x/route.ts",
      1,
    ],
    [
      "raw-upload-read",
      "export const r = (request: Request) => request.formData();",
      "app/lib/api/request-body.ts",
      0,
    ],
    [
      "content-disposition-helper",
      'export const h = { "Content-Disposition": "attachment" };',
      "app/api/x/route.ts",
      1,
    ],
    [
      "content-disposition-helper",
      'export const h = { "Content-Disposition": "attachment" };',
      "lib/utils/content-disposition.ts",
      0,
    ],
  ])("%s on %s in %s → %i", async (ruleId, source, filePath, expected) => {
    expect(await ruleHits(source, filePath, ruleId)).toBe(expected);
  });

  test("every formbricks/* rule is an error, so a new violation fails CI", async () => {
    // A v3 route file sits inside every rule's scope.
    const config = await eslint.calculateConfigForFile("app/api/v3/surveys/route.ts");
    const severities = Object.fromEntries(
      Object.entries(config.rules)
        .filter(([id]) => id.startsWith("formbricks/"))
        .map(([id, entry]) => [id, Array.isArray(entry) ? entry[0] : entry])
    );
    const { formbricksPlugin } = await import("../packages/config-eslint/formbricks-rules.mjs");
    expect(Object.keys(severities).sort()).toEqual(
      Object.keys(formbricksPlugin.rules)
        .map((id) => `formbricks/${id}`)
        .sort()
    );
    for (const severity of Object.values(severities)) expect([2, "error"]).toContain(severity);
  });
});

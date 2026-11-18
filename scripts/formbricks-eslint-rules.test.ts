import { RuleTester } from "eslint";
import { afterAll, describe, test } from "vitest";
import { formbricksPlugin } from "../packages/config-eslint/formbricks-rules.mjs";

// RuleTester drives its own describe/it; hand it vitest's so each case is a reported test.
RuleTester.describe = describe;
RuleTester.it = test;
RuleTester.itOnly = test.only;
RuleTester.afterAll = afterAll;

// Plain ESTree (espree): the rules read no TS-only syntax. apps/web's TS parsing is covered by the wiring test.
const ruleTester = new RuleTester({ languageOptions: { ecmaVersion: "latest", sourceType: "module" } });

const { rules } = formbricksPlugin;

ruleTester.run("tenant-scoped-where", rules["tenant-scoped-where"], {
  valid: [
    "prisma.survey.findUnique({ where: { id, workspaceId } });",
    "prisma.survey.findFirst({ where: { id: surveyId, workspace: { organizationId } } });",
    "tx.response.update({ where: { id_surveyId: { id, surveyId } }, data });",
    "prisma.survey.findMany({ where: { id } });",
    "prisma.survey.findUnique({ where: { ...scope, id } });",
    "prisma.survey.create({ data: { workspace: { connect: { id_organizationId: { id, organizationId } } } } });",
    "cache.get({ where: { id } });",
    // The tenant rows themselves: their id is the tenant the caller was authorized for.
    "prisma.workspace.findUnique({ where: { id: workspaceId } });",
    "tx.organization.update({ where: { id: organizationId }, data });",
    "prisma.survey.create({ data: { workspace: { connect: { id: workspaceId } } } });",
    "prisma.invite.create({ data: { organization: { connect: { id } }, creator: { connect: { id: userId } } } });",
  ],
  invalid: [
    {
      code: "prisma.survey.findUnique({ where: { id } });",
      errors: [{ messageId: "idOnlyWhere" }],
    },
    {
      code: "tx.response.delete({ where: { id: responseId } });",
      errors: [{ messageId: "idOnlyWhere" }],
    },
    {
      code: 'prisma.tag.upsert({ where: { "id": tagId }, create, update });',
      errors: [{ messageId: "idOnlyWhere" }],
    },
    {
      code: "prisma.survey.findFirstOrThrow({ where: { id: surveyId } });",
      errors: [{ messageId: "idOnlyWhere" }],
    },
    {
      code: "prisma.user.findUnique({ where: { id: body.userId } });",
      errors: [{ messageId: "idOnlyWhere" }],
    },
    {
      code: "prisma.response.create({ data: { survey: { connect: { id: surveyId } } } });",
      errors: [{ messageId: "idOnlyConnect" }],
    },
  ],
});

ruleTester.run("loggable-error", rules["loggable-error"], {
  valid: [
    'logger.error({ ...loggableError(error), surveyId }, "Import failed");',
    'logger.error({ err: loggableError(error) }, "Import failed");',
    'logger.warn({ retryDelayMs }, "Retry scheduled");',
    'logger.info("Started");',
    'logger.error({ errorCode: code }, "Rejected");',
    'logger.error({ message: "fixed text" }, "x");',
    "console.error({ err: error });",
    'logger.error({ err: error.name }, "x");',
    'logger.warn({ hasError }, "Partial result");',
    "logger.info(`hasError=${hasError.message}`);",
  ],
  invalid: [
    { code: 'logger.error({ err: error }, "Import failed");', errors: [{ messageId: "rawError" }] },
    { code: 'logger.warn({ error }, "Import failed");', errors: [{ messageId: "rawError" }] },
    { code: 'scopedLogger.error({ error: e }, "x");', errors: [{ messageId: "rawError" }] },
    { code: 'logger.error(error, "Import failed");', errors: [{ messageId: "rawError" }] },
    { code: 'logger.error({ reason: error.message }, "x");', errors: [{ messageId: "errorMessage" }] },
    { code: "logger.error(`failed: ${err.message}`);", errors: [{ messageId: "errorMessage" }] },
    { code: 'this.logger.error({ err }, "x");', errors: [{ messageId: "rawError" }] },
    { code: 'logger.error({ error: result.error }, "x");', errors: [{ messageId: "rawError" }] },
    { code: 'logger.warn({ cause: err.cause.message }, "x");', errors: [{ messageId: "errorMessage" }] },
    { code: 'logger.child({ surveyId }).warn({ error }, "x");', errors: [{ messageId: "rawError" }] },
  ],
});

ruleTester.run("strict-input-object", rules["strict-input-object"], {
  valid: [
    "const s = z.strictObject({ name: z.string() });",
    "const s = z.object({ name: z.string() }).strict();",
    'const s = z.object({ name: z.string() }).describe("x").strict();',
    "const s = z.looseObject({ name: z.string() });",
    "const s = z.object({ name: z.string() }).passthrough();",
    "registerScopedTool(server, { inputSchema: zInput }, handler);",
    "registerScopedTool(server, { inputSchema: zInput }, (input) => Object.keys(zInput.shape));",
  ],
  invalid: [
    { code: "const s = z.object({ name: z.string() });", errors: [{ messageId: "looseObject" }] },
    { code: "const s = z.object({ name: z.string() }).strip();", errors: [{ messageId: "looseObject" }] },
    {
      code: 'const s = z.object({ name: z.string() }).describe("x");',
      errors: [{ messageId: "looseObject" }],
    },
    {
      code: "const s = z.strictObject({ inner: z.object({ a: z.string() }) });",
      errors: [{ messageId: "looseObject" }],
    },
    {
      code: "registerScopedTool(server, { inputSchema: zInput.shape }, handler);",
      errors: [{ messageId: "shapeToTool" }],
    },
  ],
});

const roleGate = [{ operand: "^(role|\\w+Role)$", values: ["owner", "manager"], gate: "getAccessFlags" }];

ruleTester.run("gate-predicate", rules["gate-predicate"], {
  valid: [
    { code: "const { isOwner } = getAccessFlags(membership.role);", options: roleGate },
    { code: 'const label = role === "member" ? a : b;', options: roleGate },
    { code: 'const options = [{ value: "owner", label: t("owner") }];', options: roleGate },
    { code: 'if (status === "owner") {}', options: roleGate },
    { code: 'if (role === "owner") {}', options: [] },
  ],
  invalid: [
    { code: 'if (role === "owner") {}', options: roleGate, errors: [{ messageId: "secondCopy" }] },
    {
      code: 'const ok = membership.role !== "manager";',
      options: roleGate,
      errors: [{ messageId: "secondCopy" }],
    },
    { code: 'if ("owner" == currentUserRole) {}', options: roleGate, errors: [{ messageId: "secondCopy" }] },
  ],
});

const deletionServices = [
  { survey: "modules/survey/lib/surveys.ts", response: "lib/response/delete-responses.ts" },
];

ruleTester.run("deletion-service", rules["deletion-service"], {
  valid: [
    {
      code: "tx.survey.delete({ where: { id } });",
      options: deletionServices,
      filename: "/repo/apps/web/modules/survey/lib/surveys.ts",
    },
    {
      code: "tx.response.deleteMany({ where });",
      options: deletionServices,
      filename: "/repo/apps/web/lib/response/delete-responses.ts",
    },
    {
      code: "tx.tag.delete({ where: { id } });",
      options: deletionServices,
      filename: "/repo/apps/web/lib/x.ts",
    },
    { code: "cache.delete(key);", options: deletionServices, filename: "/repo/apps/web/lib/x.ts" },
  ],
  invalid: [
    {
      code: "prisma.survey.delete({ where: { id } });",
      options: deletionServices,
      filename: "/repo/apps/web/modules/survey/editor/lib/x.ts",
      errors: [{ messageId: "outsideService" }],
    },
    {
      code: "tx.response.deleteMany({ where: { surveyId } });",
      options: deletionServices,
      filename: "/repo/apps/web/modules/survey/lib/surveys.ts",
      errors: [{ messageId: "outsideService" }],
    },
  ],
});

ruleTester.run("spreadsheet-writer", rules["spreadsheet-writer"], {
  valid: [
    'import * as xlsx from "xlsx"; const book = xlsx.read(bytes);',
    'import Papa from "papaparse"; Papa.parse(text);',
    'import { read, utils } from "xlsx"; utils.sheet_to_json(read(bytes).Sheets.a);',
    'import { convertToCsv } from "@/lib/utils/file-conversion"; convertToCsv(fields, rows);',
    "const utils = { json_to_sheet: () => 1 }; utils.json_to_sheet();",
  ],
  invalid: [
    {
      code: 'import * as xlsx from "xlsx"; xlsx.utils.json_to_sheet(rows);',
      errors: [{ messageId: "writer" }],
    },
    { code: 'import { utils, write } from "xlsx"; write(book, opts);', errors: [{ messageId: "writer" }] },
    { code: 'import { utils } from "xlsx"; utils.aoa_to_sheet(rows);', errors: [{ messageId: "writer" }] },
    { code: 'import Papa from "papaparse"; Papa.unparse(rows);', errors: [{ messageId: "writer" }] },
    { code: 'import { AsyncParser } from "@json2csv/node";', errors: [{ messageId: "writer" }] },
  ],
});

ruleTester.run("raw-upload-read", rules["raw-upload-read"], {
  valid: [
    "const form = await parseFormDataWithLimit(request, limit);",
    "const blob = await response.blob();",
    "const data = await request.json();",
  ],
  invalid: [
    { code: "const form = await request.formData();", errors: [{ messageId: "unbounded" }] },
    { code: "const bytes = await req.arrayBuffer();", errors: [{ messageId: "unbounded" }] },
    { code: "const file = await request.blob();", errors: [{ messageId: "unbounded" }] },
  ],
});

ruleTester.run("content-disposition-helper", rules["content-disposition-helper"], {
  valid: [
    'new Response(body, { headers: { "Content-Disposition": buildAttachmentContentDisposition(name) } });',
    'const h = { "Content-Disposition": buildAttachmentArchiveContentDisposition(name, id) };',
    'headers.set("content-disposition", buildAttachmentContentDisposition(name));',
    'const name = getContentDispositionFileName(response.headers.get("Content-Disposition"));',
  ],
  invalid: [
    {
      code: 'const h = { "Content-Disposition": `attachment; filename="${name}"` };',
      errors: [{ messageId: "handBuilt" }],
    },
    { code: 'headers.set("Content-Disposition", "attachment");', errors: [{ messageId: "handBuilt" }] },
    { code: 'const h = { "content-disposition": value };', errors: [{ messageId: "handBuilt" }] },
    {
      code: 'const h = { "Content-Disposition": buildMyContentDisposition(name) };',
      errors: [{ messageId: "handBuilt" }],
    },
  ],
});

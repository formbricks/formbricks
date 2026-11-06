import { beforeEach, describe, expect, test, vi } from "vitest";
import * as XLSX from "xlsx";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { problemForbidden } from "@/app/api/v3/lib/response";
import { editExcelExport, rowOf } from "@/modules/survey/excel-export/__fixtures__/edit-sheet";
import { createIcuTranslate } from "@/modules/survey/excel-export/__fixtures__/translate";
import { writeExcelExport } from "@/modules/survey/excel-export/write";
import { openSurveyImportUploadInProcess } from "@/modules/survey/import/core/__fixtures__/in-process-upload";
import { SURVEY_IMPORT_SHEET_MAX_COLUMNS } from "@/modules/survey/import/limits";
import { EVERY_TEXT_SURVEY } from "@/modules/survey/lib/__fixtures__/every-text-survey";
import { streamSurveyImport } from "./operations";

/**
 * New survey › Import of an `.xlsx` (ENG-6809): the Excel export of a survey the user may update goes to
 * the Excel export lane and is matched with that survey; every other workbook goes to the document
 * import, as on any spreadsheet. The document lane is seen here by its AI gate, which the Excel export
 * lane never reaches.
 */

const mocks = vi.hoisted(() => ({
  requireV3WorkspaceAccess: vi.fn(),
  getAuthorizedV3Survey: vi.fn(),
  applyRateLimit: vi.fn(),
  assertOrganizationAIConfigured: vi.fn(),
  previewFormbricksFileImport: vi.fn(),
  exportFormbricksFile: vi.fn(),
  readFormbricksFile: vi.fn(),
  buildFormbricksFileMatch: vi.fn(),
  hasSurveyResponses: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v3/lib/auth", () => ({
  requireV3WorkspaceAccess: mocks.requireV3WorkspaceAccess,
  getV3AuthorizationActor: () => ({ type: "user", id: "user_1" }),
}));
vi.mock("@/app/api/v3/surveys/authorization", () => ({ getAuthorizedV3Survey: mocks.getAuthorizedV3Survey }));
vi.mock("@/app/api/v3/surveys/lib/operations", () => ({
  getSessionUserId: (authentication: { user?: { id?: string } }) => authentication?.user?.id ?? null,
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/lib/ai/service", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  assertOrganizationAIConfigured: mocks.assertOrganizationAIConfigured,
}));
vi.mock("@/lib/user/locale", () => ({ getUserLocaleOrDefault: async () => "en-US" }));
// The app's `getTranslate` can't format ICU under Vitest; the real messages are read instead.
vi.mock("@/lingodotdev/server", () => ({
  getTranslate: async (locale: string) => createIcuTranslate(locale),
}));
// Vitest cannot start the app's worker, so the upload is read in this thread, across the same boundary.
vi.mock("@/modules/survey/import/core/upload-thread", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/survey/import/core/upload-thread")>()),
  openSurveyImportUpload: (bytes: Uint8Array) => openSurveyImportUploadInProcess(bytes),
}));
// What reads and writes the database is the integration suite's; the sheet's reader and merge run.
vi.mock("@/modules/survey/formbricks-file/import", () => ({
  previewFormbricksFileImport: mocks.previewFormbricksFileImport,
}));
vi.mock("@/modules/survey/formbricks-file/export", () => ({
  exportFormbricksFile: mocks.exportFormbricksFile,
}));
vi.mock("@/modules/survey/formbricks-file/read", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/survey/formbricks-file/read")>()),
  readFormbricksFile: mocks.readFormbricksFile,
}));
vi.mock("@/modules/survey/formbricks-file/update", () => ({
  buildFormbricksFileMatch: mocks.buildFormbricksFileMatch,
  findFormbricksFileMatch: vi.fn(),
  hasSurveyResponses: mocks.hasSurveyResponses,
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => mocks.log), error: vi.fn(), warn: vi.fn() },
}));

const INSTANCE = "/api/internal/surveys/import/stream";
const WORKSPACE_ID = "clworkspace00000000000001";
const t = createIcuTranslate("en-US");
const UPDATED_AT = new Date("2026-11-06T10:00:00.000Z");
const SURVEY = {
  ...EVERY_TEXT_SURVEY,
  workspaceId: WORKSPACE_ID,
  updatedAt: UPDATED_AT,
  archivedAt: null,
} as unknown as TSurvey;
const VISIBILITY = { access: "test-visibility" };
const DRAFT = { name: "Every text", blocks: [], languages: [] };
const MATCH = { surveyId: SURVEY.id, name: SURVEY.name, updateRefusal: [] };
/** What the AI gate answers in these tests: reaching it is what shows the document lane was taken. */
const AI_GATE_CODE = "ai_features_not_enabled";

const importFile = (file: File) =>
  streamSurveyImport({
    req: new Request(`http://localhost${INSTANCE}`, { method: "POST" }),
    authentication: { user: { id: "user_1" } } as never,
    workspaceId: WORKSPACE_ID,
    file,
    requestId: "req_1",
    instance: INSTANCE,
  });

const readEvents = async (response: Response) =>
  (await response.text())
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as { type: string; [key: string]: unknown });

const sheetFile = (bytes: Uint8Array, name = "Every text.xlsx") => new File([new Uint8Array(bytes)], name);
const exportOf = (survey: TSurvey) => sheetFile(writeExcelExport({ survey, t, locale: "en-US" }));

const authorized = (survey: TSurvey) => ({
  survey,
  authResult: { organizationId: "clorg000000000000000001" },
  response: null,
  visibility: VISIBILITY,
});

/** The response went through the document lane: it reached the AI gate, and no survey was matched. */
const expectDocumentLane = async (response: Response) => {
  expect(response.status).toBe(403);
  await expect(response.json()).resolves.toMatchObject({ code: AI_GATE_CODE });
  expect(mocks.assertOrganizationAIConfigured).toHaveBeenCalledTimes(1);
  expect(mocks.exportFormbricksFile).not.toHaveBeenCalled();
  expect(mocks.buildFormbricksFileMatch).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireV3WorkspaceAccess.mockResolvedValue({
    organizationId: "clorg000000000000000001",
    workspaceId: WORKSPACE_ID,
  });
  mocks.getAuthorizedV3Survey.mockResolvedValue(authorized(SURVEY));
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.assertOrganizationAIConfigured.mockRejectedValue(new OperationNotAllowedError(AI_GATE_CODE));
  mocks.exportFormbricksFile.mockResolvedValue({ formbricks: {}, survey: {}, references: {} });
  mocks.readFormbricksFile.mockReturnValue({
    content: { survey: {}, references: {} },
    issues: [],
    source: null,
  });
  mocks.previewFormbricksFileImport.mockResolvedValue({
    draft: DRAFT,
    references: { actionClasses: [], attributeKeys: [], embeddedFields: [], languages: [] },
    issues: [],
    source: null,
    plan: { actionClasses: new Map(), attributeKeysToCreate: [], languagesToCreate: [], issues: [] },
  });
  mocks.buildFormbricksFileMatch.mockResolvedValue(MATCH);
  mocks.hasSurveyResponses.mockResolvedValue(false);
});

describe("streamSurveyImport: an Excel export of a survey the user may update", () => {
  test("is applied to that survey with no AI and offered as the Match, checked against the survey as read now", async () => {
    const bytes = editExcelExport(writeExcelExport({ survey: SURVEY, t, locale: "en-US" }), (rows) => {
      rows[rowOf(rows, "element.open.headline")][4] = "Was können wir besser machen?";
      return rows;
    });

    const response = await importFile(sheetFile(bytes));
    const events = await readEvents(response);

    expect(response.status).toBe(200);
    expect(mocks.assertOrganizationAIConfigured).not.toHaveBeenCalled();
    expect(mocks.getAuthorizedV3Survey).toHaveBeenCalledWith(
      expect.objectContaining({ surveyId: SURVEY.id, access: "readWrite" })
    );
    // The survey the draft is written from has the sheet's text, and is written as the user sees it.
    const [{ survey: applied, visibility }] = mocks.exportFormbricksFile.mock.calls[0];
    expect(visibility).toBe(VISIBILITY);
    const open = (applied as TSurvey).blocks[0].elements[0] as unknown as { headline: unknown };
    expect(open.headline).toEqual({
      default: "What should we improve?",
      de: "Was können wir besser machen?",
    });
    expect(mocks.buildFormbricksFileMatch).toHaveBeenCalledWith(
      expect.objectContaining({ survey: SURVEY, exportedUpdatedAt: UPDATED_AT.toISOString() })
    );
    const done = events.find((event) => event.type === "done") as unknown as {
      match: unknown;
      report: { source: { kind: string }; issues: { code: string; params?: unknown }[] };
    };
    expect(done.match).toEqual(MATCH);
    expect(done.report.source.kind).toBe("excel_export");
    expect(done.report.issues[0]).toEqual({ code: "texts_updated", severity: "info", params: { count: 1 } });
  });

  test("is imported even where AI is off, since it needs none", async () => {
    const response = await importFile(exportOf(SURVEY));

    expect(response.status).toBe(200);
    expect(mocks.assertOrganizationAIConfigured).not.toHaveBeenCalled();
  });

  test("tells the Match the survey has responses, so the review lists what an Update would remove", async () => {
    mocks.hasSurveyResponses.mockResolvedValue(true);

    await readEvents(await importFile(exportOf(SURVEY)));

    expect(mocks.hasSurveyResponses).toHaveBeenCalledWith(SURVEY.id);
    expect(mocks.buildFormbricksFileMatch).toHaveBeenCalledWith(
      expect.objectContaining({ hasResponses: true })
    );
  });
});

describe("streamSurveyImport: any other workbook goes to the document import", () => {
  test("an export of a survey the user may not update, the same as one of a survey that never existed", async () => {
    const forbidden = problemForbidden("req_1", "You are not authorized to access this resource", INSTANCE);
    mocks.getAuthorizedV3Survey.mockResolvedValue({ survey: null, authResult: null, response: forbidden });

    await expectDocumentLane(await importFile(exportOf(SURVEY)));
  });

  test("an export of a survey in another workspace", async () => {
    mocks.getAuthorizedV3Survey.mockResolvedValue(
      authorized({ ...SURVEY, workspaceId: "clotherworkspace000000001" } as TSurvey)
    );

    await expectDocumentLane(await importFile(exportOf(SURVEY)));
  });

  test("an export of an archived survey", async () => {
    mocks.getAuthorizedV3Survey.mockResolvedValue(
      authorized({ ...SURVEY, archivedAt: new Date() } as TSurvey)
    );

    await expectDocumentLane(await importFile(exportOf(SURVEY)));
  });

  test("an export whose survey id is not one, without looking it up", async () => {
    await expectDocumentLane(await importFile(exportOf({ ...SURVEY, id: "../../surveys" } as TSurvey)));

    expect(mocks.getAuthorizedV3Survey).not.toHaveBeenCalled();
  });

  test("an export this version can't read back, its key column cleared, without looking it up", async () => {
    const bytes = editExcelExport(writeExcelExport({ survey: SURVEY, t, locale: "en-US" }), (rows) =>
      rows.map(([, ...rest]) => ["", ...rest])
    );

    await expectDocumentLane(await importFile(sheetFile(bytes)));

    expect(mocks.getAuthorizedV3Survey).not.toHaveBeenCalled();
  });

  test("a workbook with no export sheet, without looking anything up", async () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([
        ["Question", "Type"],
        ["Q1?", "Text"],
      ]),
      "Sheet1"
    );
    const bytes = new Uint8Array(XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer);

    await expectDocumentLane(await importFile(sheetFile(bytes, "questions.xlsx")));

    expect(mocks.getAuthorizedV3Survey).not.toHaveBeenCalled();
  });

  test("a workbook the document import refuses is refused after the AI gate, as on any spreadsheet", async () => {
    const book = XLSX.utils.book_new();
    const wide = Array.from({ length: SURVEY_IMPORT_SHEET_MAX_COLUMNS + 1 }, (_, column) => `C${column}`);
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([wide, wide]), "Sheet1");
    const bytes = new Uint8Array(XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer);

    // With AI off, the gate answers first.
    await expectDocumentLane(await importFile(sheetFile(bytes, "wide.xlsx")));

    mocks.assertOrganizationAIConfigured.mockResolvedValue({ isInstanceConfigured: true });
    const response = await importFile(sheetFile(bytes, "wide.xlsx"));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      invalid_params: [expect.objectContaining({ code: "document_limit_exceeded" })],
    });
  });
});

import { beforeEach, describe, expect, test, vi } from "vitest";
import * as XLSX from "xlsx";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { problemForbidden, problemUnprocessableContent } from "@/app/api/v3/lib/response";
import { V3SurveyArchivedError } from "@/app/api/v3/surveys/patch";
import { editExcelExport, rowOf } from "@/modules/survey/excel-export/__fixtures__/edit-sheet";
import { createIcuTranslate } from "@/modules/survey/excel-export/__fixtures__/translate";
import { writeExcelExport } from "@/modules/survey/excel-export/write";
import { openSurveyImportUploadInProcess } from "@/modules/survey/import/core/__fixtures__/in-process-upload";
import { docx, p } from "@/modules/survey/import/document/__fixtures__/docx-builders";
import { EVERY_TEXT_SURVEY } from "@/modules/survey/lib/__fixtures__/every-text-survey";
import { streamSurveyImportIntoSurvey } from "./operations";

const mocks = vi.hoisted(() => ({
  getAuthorizedV3Survey: vi.fn(),
  mapV3SurveyPatchError: vi.fn(),
  previewFormbricksFileImport: vi.fn(),
  exportFormbricksFile: vi.fn(),
  readFormbricksFile: vi.fn(),
  buildFormbricksFileMatch: vi.fn(),
  findFormbricksFileMatch: vi.fn(),
  hasSurveyResponses: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v3/surveys/authorization", () => ({ getAuthorizedV3Survey: mocks.getAuthorizedV3Survey }));
vi.mock("@/app/api/v3/surveys/lib/operations", () => ({
  getSessionUserId: (authentication: { user?: { id?: string } }) => authentication?.user?.id ?? null,
  mapV3SurveyPatchError: mocks.mapV3SurveyPatchError,
}));
vi.mock("@/app/api/v3/lib/auth", () => ({
  requireV3WorkspaceAccess: vi.fn(),
  getV3AuthorizationActor: () => ({ type: "user", id: "user_1" }),
}));
vi.mock("@/lib/user/locale", () => ({ getUserLocaleOrDefault: async () => "en-US" }));
// The app's `getTranslate` can't format ICU under Vitest; the real messages are read instead.
vi.mock("@/lingodotdev/server", () => ({
  getTranslate: async (locale: string) => createIcuTranslate(locale),
}));
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
  findFormbricksFileMatch: mocks.findFormbricksFileMatch,
  hasSurveyResponses: mocks.hasSurveyResponses,
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => mocks.log), error: vi.fn(), warn: vi.fn() },
}));

const INSTANCE = "/api/internal/surveys/clsurvey0000000000000001/import/stream";
const t = createIcuTranslate("en-US");
const UPDATED_AT = new Date("2026-11-06T10:00:00.000Z");
const SURVEY = {
  ...EVERY_TEXT_SURVEY,
  workspaceId: "clworkspace00000000000001",
  updatedAt: UPDATED_AT,
  archivedAt: null,
} as unknown as TSurvey;
const VISIBILITY = { access: "test-visibility" };
const DRAFT = { name: "Every text", blocks: [], languages: [] };
const MATCH = { surveyId: SURVEY.id, name: SURVEY.name };

const importInto = (file: File) =>
  streamSurveyImportIntoSurvey({
    req: new Request(`http://localhost${INSTANCE}`, { method: "POST" }),
    authentication: { user: { id: "user_1" } } as never,
    surveyId: SURVEY.id,
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthorizedV3Survey.mockResolvedValue({
    survey: SURVEY,
    authResult: { organizationId: "clorg000000000000000001" },
    response: null,
    visibility: VISIBILITY,
  });
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

describe("streamSurveyImportIntoSurvey", () => {
  test("answers a survey the user may not edit as the authorization does, reading nothing", async () => {
    const forbidden = problemForbidden("req_1", "You are not authorized to access this resource", INSTANCE);
    mocks.getAuthorizedV3Survey.mockResolvedValue({ survey: null, authResult: null, response: forbidden });

    const response = await importInto(sheetFile(writeExcelExport({ survey: SURVEY, t, locale: "en-US" })));

    expect(response).toBe(forbidden);
    expect(mocks.getAuthorizedV3Survey).toHaveBeenCalledWith(
      expect.objectContaining({ surveyId: SURVEY.id, access: "readWrite" })
    );
    expect(mocks.exportFormbricksFile).not.toHaveBeenCalled();
  });

  test("refuses an archived survey as an update of it would be", async () => {
    mocks.getAuthorizedV3Survey.mockResolvedValue({
      survey: { ...SURVEY, archivedAt: new Date() },
      authResult: { organizationId: "clorg000000000000000001" },
      response: null,
      visibility: VISIBILITY,
    });
    const archived = problemUnprocessableContent("req_1", "Survey is archived", { instance: INSTANCE });
    mocks.mapV3SurveyPatchError.mockReturnValue(archived);

    const response = await importInto(sheetFile(writeExcelExport({ survey: SURVEY, t, locale: "en-US" })));

    expect(response).toBe(archived);
    expect(mocks.mapV3SurveyPatchError.mock.calls[0][0]).toBeInstanceOf(V3SurveyArchivedError);
  });

  test("takes only a Formbricks file or an Excel export: a Word file is a 415", async () => {
    const response = await importInto(new File([docx({ body: p("Question one?") })], "survey.docx"));

    expect(response.status).toBe(415);
    expect((await response.json()).invalid_params[0]).toMatchObject({ code: "file_type_unsupported" });
  });

  test("refuses a workbook that is not an Excel export of a survey, without asking any AI", async () => {
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

    const response = await importInto(sheetFile(bytes, "questions.xlsx"));

    expect(response.status).toBe(422);
    expect((await response.json()).invalid_params[0]).toMatchObject({ code: "excel_export_not_recognized" });
  });

  test("applies an edited export to the survey and offers it as the Match, checked against the survey as read now", async () => {
    const bytes = editExcelExport(writeExcelExport({ survey: SURVEY, t, locale: "en-US" }), (rows) => {
      rows[rowOf(rows, "element.open.headline")][4] = "Was können wir besser machen?";
      return rows;
    });

    const response = await importInto(sheetFile(bytes));
    const events = await readEvents(response);

    expect(response.status).toBe(200);
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

  test("tells the Match the survey has responses, so the review lists what an Update would remove", async () => {
    mocks.hasSurveyResponses.mockResolvedValue(true);

    await readEvents(await importInto(sheetFile(writeExcelExport({ survey: SURVEY, t, locale: "en-US" }))));

    expect(mocks.hasSurveyResponses).toHaveBeenCalledWith(SURVEY.id);
    expect(mocks.buildFormbricksFileMatch).toHaveBeenCalledWith(
      expect.objectContaining({ hasResponses: true })
    );
  });

  test("matches a Formbricks file to this survey, whatever survey the file names", async () => {
    mocks.readFormbricksFile.mockReturnValue({
      content: { survey: {}, references: {} },
      issues: [],
      source: { surveyId: "clothersurvey000000000001", updatedAt: "2026-01-01T00:00:00.000Z" },
    });
    mocks.previewFormbricksFileImport.mockImplementation(async ({ read }) => ({
      draft: DRAFT,
      references: { actionClasses: [], attributeKeys: [], embeddedFields: [], languages: [] },
      issues: [],
      source: read.source,
      plan: { actionClasses: new Map(), attributeKeysToCreate: [], languagesToCreate: [], issues: [] },
    }));

    const response = await importInto(
      new File([JSON.stringify({ formbricks: {} })], "other.formbricks.json")
    );
    await readEvents(response);

    expect(mocks.findFormbricksFileMatch).not.toHaveBeenCalled();
    // Another survey's file is checked against this survey as read now, not the file's export time.
    expect(mocks.buildFormbricksFileMatch).toHaveBeenCalledWith(
      expect.objectContaining({ survey: SURVEY, exportedUpdatedAt: UPDATED_AT.toISOString() })
    );
  });
});

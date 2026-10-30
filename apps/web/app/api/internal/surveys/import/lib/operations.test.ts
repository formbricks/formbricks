import { APICallError } from "ai";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as XLSX from "xlsx";
import { OperationNotAllowedError, TooManyRequestsError } from "@formbricks/types/errors";
import {
  V3_REQUEST_ARRAY_MAX_ITEMS,
  V3_REQUEST_ARRAY_MAX_TOTAL_ELEMENTS,
  V3_REQUEST_MAX_DEPTH,
} from "@/app/api/v3/lib/array-budget";
import { problemForbidden } from "@/app/api/v3/lib/response";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { zipOf } from "@/modules/survey/import/core/__fixtures__/zip-builders";
import { SurveyImportInputError, SurveyImportTimeoutError } from "@/modules/survey/import/core/errors";
import type { TSurveyImportLane, TSurveyImportResult } from "@/modules/survey/import/core/lane";
import { docx, p } from "@/modules/survey/import/document/__fixtures__/docx-builders";
import {
  SURVEY_IMPORT_DEADLINE_MS,
  SURVEY_IMPORT_MAX_FILE_BYTES,
  SURVEY_IMPORT_SHEET_MAX_COLUMNS,
  SURVEY_IMPORT_WORD_MAX_TABLES,
  SURVEY_IMPORT_ZIP_MAX_ENTRIES,
} from "@/modules/survey/import/limits";
import type { TRunQsfImportParams } from "@/modules/survey/import/qsf/pipeline";
import { SURVEY_IMPORT_HEARTBEAT_MS } from "./constants";
import { runSurveyImportLane, streamSurveyImport } from "./operations";

const mocks = vi.hoisted(() => ({
  requireV3WorkspaceAccess: vi.fn(),
  applyRateLimit: vi.fn(),
  assertOrganizationAIConfigured: vi.fn(),
  runQsfImport: vi.fn(),
  prepareQsfImport: vi.fn(),
  previewFormbricksFileImport: vi.fn(),
  runDocumentImport: vi.fn(),
  findFormbricksFileMatch: vi.fn(),
  realPrepareQsfImport:
    undefined as unknown as typeof import("@/modules/survey/import/qsf/pipeline").prepareQsfImport,
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const aiTimeoutEnv = vi.hoisted(() => ({ multiplier: 1 }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/env")>();
  return {
    ...original,
    env: {
      ...original.env,
      get AI_TIMEOUT_MULTIPLIER() {
        return aiTimeoutEnv.multiplier;
      },
    },
  };
});
vi.mock("@/app/api/v3/lib/auth", () => ({
  requireV3WorkspaceAccess: mocks.requireV3WorkspaceAccess,
  getV3AuthorizationActor: (authentication: { user?: { id?: string } }) =>
    authentication?.user?.id ? { type: "user", id: authentication.user.id } : null,
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/app/api/v3/surveys/lib/operations", () => ({
  getSessionUserId: (authentication: { user?: { id?: string } }) => authentication?.user?.id ?? null,
}));
vi.mock("@/lib/ai/service", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  assertOrganizationAIConfigured: mocks.assertOrganizationAIConfigured,
}));
// The real reader runs, behind a spy a test can make fail; only the AI-backed part is replaced.
vi.mock("@/modules/survey/import/qsf/pipeline", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/survey/import/qsf/pipeline")>();
  mocks.realPrepareQsfImport = original.prepareQsfImport;
  return { ...original, prepareQsfImport: mocks.prepareQsfImport, runQsfImport: mocks.runQsfImport };
});
// The document lanes' readers run; their AI-backed part, and its naming against the database, is the
// integration suite's.
vi.mock("@/modules/survey/import/document/pipeline", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/survey/import/document/pipeline")>()),
  runDocumentImport: mocks.runDocumentImport,
}));
// The Formbricks file lane's preview reads the database; its seam is the integration suite.
vi.mock("@/modules/survey/formbricks-file/import", () => ({
  previewFormbricksFileImport: mocks.previewFormbricksFileImport,
}));
vi.mock("@/modules/survey/formbricks-file/update", () => ({
  findFormbricksFileMatch: mocks.findFormbricksFileMatch,
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => mocks.log), error: vi.fn(), warn: vi.fn() },
}));

const INSTANCE = "/api/internal/surveys/import/stream";

/** A one-sheet workbook of text rows, as Excel would save it. */
const xlsxOf = (rows: string[][]): Uint8Array<ArrayBuffer> => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
  return new Uint8Array(XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer);
};

/** A marker that must never reach a log line or an error event: it stands for the file's questions. */
const FILE_CONTENT_MARKER = "Q1-secret-wording-from-the-file";

const body = {
  workspaceId: "clxx1234567890123456789012",
  fileName: "onboarding.qsf",
  qsf: {
    SurveyEntry: { SurveyName: "Onboarding", SurveyLanguage: "EN" },
    SurveyElements: [
      {
        Element: "SQ",
        PrimaryAttribute: "QID1",
        Payload: { QuestionText: FILE_CONTENT_MARKER, QuestionType: "TE" },
      },
      { Element: "BL", Payload: [{ ID: "BL_1", BlockElements: [{ Type: "Question", QuestionID: "QID1" }] }] },
      { Element: "FL", Payload: { Flow: [{ Type: "Block", ID: "BL_1" }] } },
    ],
  },
};

const importResult: TSurveyImportResult = {
  payload: { workspaceId: body.workspaceId, name: "Onboarding (imported)" } as never,
  report: {
    source: { kind: "qsf", fileName: "onboarding.qsf" },
    summary: {
      blocks: 1,
      questions: 1,
      languages: ["en-US"],
      logicRules: 0,
      importedLogicRules: 0,
      hiddenFields: 0,
    },
    issues: [],
  },
  usage: { inputTokens: 1200, outputTokens: 300 },
};

/** An uploaded file, as the route hands it over: a name and a part type the import never trusts. */
const upload = (content: BlobPart, name = body.fileName, type = "application/octet-stream") =>
  new File([content], name, { type });

const importFile = (file: File, signal?: AbortSignal) =>
  streamSurveyImport({
    req: new Request("http://localhost/api/internal/surveys/import/stream", { method: "POST", signal }),
    authentication: { user: { id: "user_1" } } as never,
    workspaceId: body.workspaceId,
    file,
    requestId: "req_1",
    instance: INSTANCE,
  });

const call = (signal?: AbortSignal, qsf: Record<string, unknown> = body.qsf) =>
  importFile(upload(JSON.stringify(qsf)), signal);

const readEvents = async (response: Response) =>
  (await response.text())
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as { type: string; [key: string]: unknown });

/** Every argument any log call received, flattened, to search for leaked file content. */
const allLogged = () =>
  JSON.stringify([...mocks.log.info.mock.calls, ...mocks.log.warn.mock.calls, ...mocks.log.error.mock.calls]);

/** runQsfImport that reports its stages and never finishes until its signal aborts. */
const hangUntilAborted = () =>
  mocks.runQsfImport.mockImplementation(
    ({ signal, onProgress }: TRunQsfImportParams) =>
      new Promise((_resolve, reject) => {
        onProgress("ai");
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      })
  );

describe("streamSurveyImport", () => {
  beforeEach(() => {
    aiTimeoutEnv.multiplier = 1;
    vi.clearAllMocks();
    mocks.requireV3WorkspaceAccess.mockResolvedValue({
      organizationId: "org_1",
      workspaceId: body.workspaceId,
    });
    mocks.assertOrganizationAIConfigured.mockResolvedValue({ isInstanceConfigured: true });
    mocks.applyRateLimit.mockResolvedValue(undefined);
    mocks.prepareQsfImport.mockImplementation(mocks.realPrepareQsfImport);
    mocks.runQsfImport.mockImplementation(async ({ onProgress }: TRunQsfImportParams) => {
      onProgress("ai");
      onProgress("assembling");
      return importResult;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("before the stream opens", () => {
    test("returns the access check's 403 as is and does nothing else", async () => {
      mocks.requireV3WorkspaceAccess.mockResolvedValue(problemForbidden("req_1", "Forbidden"));

      const response = await call();

      expect(response.status).toBe(403);
      expect(mocks.requireV3WorkspaceAccess).toHaveBeenCalledWith(
        expect.anything(),
        body.workspaceId,
        "readWrite",
        "req_1",
        INSTANCE
      );
      expect(mocks.assertOrganizationAIConfigured).not.toHaveBeenCalled();
      expect(mocks.runQsfImport).not.toHaveBeenCalled();
    });

    test.each([
      ["ai_features_not_enabled", 403],
      ["ai_smart_tools_disabled", 403],
      ["ai_instance_not_configured", 503],
    ])("answers the AI gate reason %s with %i and its own code", async (code, status) => {
      mocks.assertOrganizationAIConfigured.mockRejectedValue(new OperationNotAllowedError(code));

      const response = await call();

      expect(response.status).toBe(status);
      expect(response.headers.get("Content-Type")).toContain("application/problem+json");
      await expect(response.json()).resolves.toMatchObject({ code });
      expect(mocks.runQsfImport).not.toHaveBeenCalled();
    });

    test("answers an exhausted AI quota with 429 and Retry-After", async () => {
      mocks.assertOrganizationAIConfigured.mockRejectedValue(new TooManyRequestsError("quota", 42));

      const response = await call();

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("42");
    });

    test("checks the AI gate before the Qualtrics reader reads the file", async () => {
      mocks.assertOrganizationAIConfigured.mockRejectedValue(
        new OperationNotAllowedError("ai_smart_tools_disabled")
      );

      // A Qualtrics export by its shape, which the reader would refuse for its missing SurveyEntry.
      const response = await call(undefined, { SurveyElements: [] });

      expect(response.status).toBe(403);
      expect(mocks.prepareQsfImport).not.toHaveBeenCalled();
    });

    test("runs a lane that uses no AI with AI off, and never asks the AI gate", async () => {
      mocks.assertOrganizationAIConfigured.mockRejectedValue(
        new OperationNotAllowedError("ai_features_not_enabled")
      );
      const lane: TSurveyImportLane<string, string> = {
        kind: "qsf",
        usesAI: false,
        rateLimit: null,
        prepare: (input) => input,
        run: async ({ onProgress }) => {
          onProgress("assembling");
          return importResult;
        },
      };

      const response = await runSurveyImportLane({
        req: new Request("http://localhost/api/internal/surveys/import/stream", { method: "POST" }),
        authentication: { user: { id: "user_1" } } as never,
        organizationId: "org_1",
        workspaceId: body.workspaceId,
        lane,
        input: "file",
        fileBytes: 4,
        requestId: "req_1",
        instance: INSTANCE,
      });

      expect(response.status).toBe(200);
      const events = await readEvents(response);
      expect(events.map((event) => event.type)).toEqual(["start", "progress", "progress", "done"]);
      expect(events.at(-1)).toMatchObject({ report: importResult.report });
      expect(mocks.assertOrganizationAIConfigured).not.toHaveBeenCalled();
      // A lane the default v3 bucket covers is charged nothing more here.
      expect(mocks.applyRateLimit).not.toHaveBeenCalled();
    });

    test("gives a lane that uses no AI its deadline unscaled by AI_TIMEOUT_MULTIPLIER", async () => {
      aiTimeoutEnv.multiplier = 3;
      const run = vi.fn(async () => importResult);
      const response = await runSurveyImportLane({
        req: new Request("http://localhost/api/internal/surveys/import/stream", { method: "POST" }),
        authentication: { user: { id: "user_1" } } as never,
        organizationId: "org_1",
        workspaceId: body.workspaceId,
        lane: { kind: "formbricks", usesAI: false, rateLimit: null, prepare: (input: string) => input, run },
        input: "file",
        fileBytes: 4,
        requestId: "req_1",
        instance: INSTANCE,
      });
      await readEvents(response);

      expect(run).toHaveBeenCalledWith(expect.objectContaining({ deadlineMs: SURVEY_IMPORT_DEADLINE_MS }));
    });

    test("answers a refusal from a lane that checks the file asynchronously before the stream opens", async () => {
      const response = await runSurveyImportLane({
        req: new Request("http://localhost/api/internal/surveys/import/stream", { method: "POST" }),
        authentication: { user: { id: "user_1" } } as never,
        organizationId: "org_1",
        workspaceId: body.workspaceId,
        lane: {
          kind: "formbricks",
          usesAI: false,
          rateLimit: null,
          prepare: async () => {
            throw new SurveyImportInputError(
              [{ name: "file.formbricks.format", reason: "Too new", identifier: "2" }],
              "The Formbricks file was written by a newer version of Formbricks.",
              "formbricks_file_too_new"
            );
          },
          run: async () => importResult,
        },
        input: "file",
        fileBytes: 4,
        requestId: "req_1",
        instance: INSTANCE,
      });

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        code: "formbricks_file_too_new",
        invalid_params: [{ name: "file.formbricks.format", identifier: "2" }],
      });
    });

    test("imports a Formbricks file without AI or the AI bucket, and sends its references with the draft", async () => {
      mocks.assertOrganizationAIConfigured.mockRejectedValue(
        new OperationNotAllowedError("ai_features_not_enabled")
      );
      const draft = {
        workspaceId: body.workspaceId,
        name: "Onboarding (imported)",
        status: "draft",
        defaultLanguage: "en-US",
        blocks: [{ id: "b1", name: "Block 1", elements: [{ id: "q1" }] }],
      };
      const references = { actionClasses: [], attributeKeys: [], embeddedFields: [] };
      const source = {
        surveyId: "clsurvey0000000000000001",
        workspaceId: body.workspaceId,
        updatedAt: "2026-10-29T09:00:00.000Z",
      };
      const plan = { actionClasses: new Map(), attributeKeysToCreate: [], languagesToCreate: [], issues: [] };
      mocks.previewFormbricksFileImport.mockResolvedValue({
        draft,
        references,
        issues: [{ code: "content_only", severity: "info" }],
        source,
        plan,
      });
      const match = {
        surveyId: source.surveyId,
        name: "Onboarding",
        status: "paused",
        updatedAt: "2026-10-30T09:00:00.000Z",
        exportedUpdatedAt: source.updatedAt,
        triggers: "same",
        issues: [],
      };
      mocks.findFormbricksFileMatch.mockResolvedValue(match);
      const file = { formbricks: { format: 1 }, survey: { name: "Onboarding" } };

      const response = await importFile(upload(JSON.stringify(file), "Onboarding.formbricks.json"));

      expect(response.status).toBe(200);
      const events = await readEvents(response);
      expect(events.map((event) => event.type)).toEqual(["start", "progress", "progress", "done"]);
      expect(events.at(-1)).toMatchObject({
        payload: draft,
        references,
        match,
        report: {
          source: { kind: "formbricks", fileName: "Onboarding.formbricks.json" },
          summary: { blocks: 1, questions: 1, languages: ["en-US"] },
          issues: [{ code: "content_only", severity: "info" }],
        },
      });
      expect(mocks.previewFormbricksFileImport).toHaveBeenCalledWith({
        file,
        workspaceId: body.workspaceId,
        organizationId: "org_1",
        userId: "user_1",
      });
      // The Match is the file's survey as the importing user may see it.
      expect(mocks.findFormbricksFileMatch).toHaveBeenCalledWith({
        source,
        workspaceId: body.workspaceId,
        actor: { type: "user", id: "user_1" },
        draft,
        plan,
      });
      expect(mocks.assertOrganizationAIConfigured).not.toHaveBeenCalled();
      expect(mocks.applyRateLimit).not.toHaveBeenCalled();
    });

    test("answers 500 when reading the file fails unexpectedly, and logs where, never what it said", async () => {
      // A reader that fails on the file can quote it, so the message stays out of the log.
      mocks.prepareQsfImport.mockImplementationOnce(() => {
        throw new SyntaxError(`Unexpected token in ${FILE_CONTENT_MARKER}`);
      });

      const response = await call();

      expect(response.status).toBe(500);
      expect(JSON.stringify(await response.json())).not.toContain(FILE_CONTENT_MARKER);
      expect(mocks.log.error).toHaveBeenCalledWith(
        expect.objectContaining({ errName: "SyntaxError", operation: "surveys.import", statusCode: 500 }),
        "Survey import could not read the file"
      );
      expect(allLogged()).not.toContain(FILE_CONTENT_MARKER);
      expect(mocks.runQsfImport).not.toHaveBeenCalled();
    });

    test("answers a QSF past the reader's limits with 422, before any AI is spent", async () => {
      let nested: unknown = { Type: "Block", ID: "BL_1" };
      for (let level = 0; level < 65; level++) nested = { Type: "Group", Flow: [nested] };
      const elements = body.qsf.SurveyElements as unknown[];

      const response = await call(undefined, {
        ...body.qsf,
        SurveyElements: [...elements.slice(0, 2), { Element: "FL", Payload: { Flow: [nested] } }],
      });

      expect(response.status).toBe(422);
      const problem = (await response.json()) as { invalid_params: { name: string; reason: string }[] };
      expect(problem.invalid_params[0].reason).toContain("deeper than 64 levels");
      expect(JSON.stringify(problem)).not.toContain(FILE_CONTENT_MARKER);
      expect(mocks.runQsfImport).not.toHaveBeenCalled();
    });

    test("answers a Qualtrics export the reader cannot read with 422 and what is missing", async () => {
      const response = await call(undefined, { SurveyElements: [] });

      expect(response.status).toBe(422);
      const problem = (await response.json()) as { invalid_params: { name: string }[] };
      expect(problem.invalid_params.map((param) => param.name)).toContain("file.SurveyEntry");
      expect(mocks.runQsfImport).not.toHaveBeenCalled();
    });
  });

  describe("the upload", () => {
    type TProblem = { status: number; detail: string; invalid_params: Record<string, string>[] };
    const problemOf = async (response: Response) => (await response.json()) as TProblem;

    test("reads the type from the bytes, not from the file's name or part type", async () => {
      const disguised = upload(
        JSON.stringify(body.qsf),
        "questionnaire.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );

      const response = await importFile(disguised);

      expect(response.status).toBe(200);
      const events = await readEvents(response);
      expect(events.at(-1)).toMatchObject({ type: "done" });
      // The name is display text: it reaches the report as it came, and decides nothing.
      expect(mocks.runQsfImport).toHaveBeenCalledWith(
        expect.objectContaining({ prepared: expect.objectContaining({ fileName: "questionnaire.docx" }) })
      );
    });

    test("charges a Qualtrics import to Create with AI's bucket, and stops at its 429 before any AI", async () => {
      await (await call()).text();
      expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.api.v3SurveyGenerate, "user_1");

      mocks.applyRateLimit.mockRejectedValueOnce(new TooManyRequestsError("Rate limit exceeded", 30));
      const limited = await call();

      expect(limited.status).toBe(429);
      expect(limited.headers.get("Retry-After")).toBe("30");
      expect(mocks.assertOrganizationAIConfigured).toHaveBeenCalledTimes(1);
      expect(mocks.runQsfImport).toHaveBeenCalledTimes(1);
    });

    test("checks the workspace before reading the file", async () => {
      mocks.requireV3WorkspaceAccess.mockResolvedValue(problemForbidden("req_1", "Forbidden"));

      const response = await importFile(
        upload(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
      );

      expect(response.status).toBe(403);
    });

    test(`takes a file of ${SURVEY_IMPORT_MAX_FILE_BYTES} bytes and refuses one more with a 413 naming the limit`, async () => {
      // Text of exactly the limit passes the size check and reaches the CSV reader, which refuses its one
      // cell as past the sheet's own limit.
      const overLimit = await importFile(upload("x".repeat(SURVEY_IMPORT_MAX_FILE_BYTES + 1)));
      // Refused before anything else: not even the upload's type, so no lane's budget is charged.
      expect(mocks.applyRateLimit).not.toHaveBeenCalled();
      const atLimit = await importFile(upload("x".repeat(SURVEY_IMPORT_MAX_FILE_BYTES)));

      expect(atLimit.status).toBe(422);
      expect((await problemOf(atLimit)).invalid_params).toEqual([
        expect.objectContaining({ code: "document_limit_exceeded", identifier: "cell_size" }),
      ]);
      expect(overLimit.status).toBe(413);
      const problem = await problemOf(overLimit);
      expect(problem.detail).toBe(`The file must not exceed ${SURVEY_IMPORT_MAX_FILE_BYTES} bytes`);
      expect(problem.invalid_params).toEqual([
        expect.objectContaining({ name: "file", code: "file_limit_exceeded", identifier: "file_size" }),
      ]);
    });

    test("refuses a .doc or .xls with a 415 that says to save it as .docx or .xlsx, before any AI", async () => {
      const legacy = new Uint8Array(512);
      legacy.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

      const response = await importFile(upload(legacy, "questionnaire.doc", "application/msword"));

      expect(response.status).toBe(415);
      expect(response.headers.get("Content-Type")).toContain("application/problem+json");
      const problem = await problemOf(response);
      expect(problem).toMatchObject({ detail: "Save the file as .docx or .xlsx" });
      expect(problem.invalid_params).toEqual([
        expect.objectContaining({ code: "file_type_unsupported", identifier: "legacy_office" }),
      ]);
      expect(mocks.applyRateLimit).not.toHaveBeenCalled();
      expect(mocks.assertOrganizationAIConfigured).not.toHaveBeenCalled();
    });

    test("reads a .docx into the Word lane, charged to Create with AI's bucket behind the AI gate", async () => {
      mocks.runDocumentImport.mockResolvedValue({
        ...importResult,
        report: { ...importResult.report, source: { kind: "docx", fileName: "questionnaire.docx" } },
        references: { actionClasses: [], attributeKeys: [], embeddedFields: [] },
      });

      const response = await importFile(
        upload(docx({ body: p("Visitor survey") + p("1. How satisfied are you?") }), "questionnaire.docx")
      );

      expect(response.status).toBe(200);
      expect((await readEvents(response)).at(-1)).toMatchObject({ type: "done" });
      expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.api.v3SurveyGenerate, "user_1");
      expect(mocks.assertOrganizationAIConfigured).toHaveBeenCalledTimes(1);
      const [{ prepared }] = mocks.runDocumentImport.mock.calls[0] as [
        { prepared: { fileName: string; model: { kind: string; cells: Map<string, string> } } },
      ];
      expect(prepared.fileName).toBe("questionnaire.docx");
      expect(prepared.model.kind).toBe("docx");
      expect(prepared.model.cells.get("P2")).toBe("1. How satisfied are you?");
    });

    test("answers a .docx past the Word limits with a 422 naming the limit, before any AI", async () => {
      const tables = "<w:tbl><w:tr><w:tc><w:p/></w:tc></w:tr></w:tbl>".repeat(
        SURVEY_IMPORT_WORD_MAX_TABLES + 1
      );

      const response = await importFile(
        upload(docx({ body: p("Q1") + tables, stored: true }), "questionnaire.docx")
      );

      expect(response.status).toBe(422);
      expect((await problemOf(response)).invalid_params).toEqual([
        expect.objectContaining({ code: "document_limit_exceeded", identifier: "tables" }),
      ]);
      expect(mocks.runDocumentImport).not.toHaveBeenCalled();
    });

    test.each([
      [
        "a .xlsx",
        () =>
          xlsxOf([
            ["ID", "Question"],
            ["Q1", "How satisfied are you?"],
          ]),
        "xlsx",
      ],
      ["a CSV", () => "ID;Question\nQ1;How satisfied are you?\n", "csv"],
    ])(
      "reads %s into its document lane, charged to Create with AI's bucket behind the AI gate",
      async (_label, content, kind) => {
        mocks.runDocumentImport.mockResolvedValue({
          ...importResult,
          report: { ...importResult.report, source: { kind, fileName: "list" } },
          references: { actionClasses: [], attributeKeys: [], embeddedFields: [] },
        });

        const response = await importFile(upload(content(), "list"));

        expect(response.status).toBe(200);
        expect((await readEvents(response)).at(-1)).toMatchObject({ type: "done" });
        expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.api.v3SurveyGenerate, "user_1");
        expect(mocks.assertOrganizationAIConfigured).toHaveBeenCalledTimes(1);
        const [{ prepared }] = mocks.runDocumentImport.mock.calls[0] as [
          { prepared: { model: { kind: string; cells: Map<string, string> } } },
        ];
        expect(prepared.model.kind).toBe(kind);
        expect(prepared.model.cells.get("B2")).toBe("How satisfied are you?");
      }
    );

    test("answers a sheet past the sheet limits with a 422 naming the limit, before any AI", async () => {
      const wide = xlsxOf([
        Array.from({ length: SURVEY_IMPORT_SHEET_MAX_COLUMNS + 1 }, (_, index) => `c${index}`),
      ]);

      const response = await importFile(upload(wide, "wide.xlsx"));

      expect(response.status).toBe(422);
      expect((await problemOf(response)).invalid_params).toEqual([
        expect.objectContaining({ code: "document_limit_exceeded", identifier: "columns" }),
      ]);
      expect(mocks.runDocumentImport).not.toHaveBeenCalled();
    });

    test("answers a .docx past the zip limits with a 413 naming the limit", async () => {
      const entries = Object.fromEntries(
        Array.from({ length: SURVEY_IMPORT_ZIP_MAX_ENTRIES + 1 }, (_, index) => [
          `word/part-${index}.xml`,
          "",
        ])
      );

      const response = await importFile(upload(zipOf(entries), "questionnaire.docx"));

      expect(response.status).toBe(413);
      const problem = await problemOf(response);
      expect(problem.detail).toBe(`The archive has more than ${SURVEY_IMPORT_ZIP_MAX_ENTRIES} entries`);
      expect(problem.invalid_params).toEqual([
        expect.objectContaining({ code: "file_limit_exceeded", identifier: "zip_entries" }),
      ]);
    });

    test("answers a Qualtrics export past the JSON budget with a 422 naming the array, before any AI", async () => {
      const elements = Array.from({ length: V3_REQUEST_ARRAY_MAX_ITEMS + 1 }, () => ({ Element: "SQ" }));

      const response = await call(undefined, { ...body.qsf, SurveyElements: elements });

      expect(response.status).toBe(422);
      const problem = await problemOf(response);
      expect(problem.invalid_params).toEqual([
        expect.objectContaining({
          name: "file.SurveyElements",
          code: "file_limit_exceeded",
          identifier: "array_items",
        }),
      ]);
      expect(mocks.applyRateLimit).not.toHaveBeenCalled();
    });

    describe("holds a Formbricks file to the JSON budget, at each limit and one past it", () => {
      const previewOk = () => {
        mocks.previewFormbricksFileImport.mockResolvedValue({
          draft: { workspaceId: body.workspaceId, name: "x", status: "draft", blocks: [] },
          references: { actionClasses: [], attributeKeys: [], embeddedFields: [] },
          issues: [],
          source: null,
          plan: { actionClasses: new Map(), attributeKeysToCreate: [], languagesToCreate: [], issues: [] },
        });
        mocks.findFormbricksFileMatch.mockResolvedValue(null);
      };
      const formbricksFileWith = (survey: Record<string, unknown>) =>
        upload(JSON.stringify({ formbricks: { format: 1 }, survey }), "survey.formbricks.json");
      /** `count` arrays, one inside the next. Under the file's root and its survey, `count + 2` deep. */
      const arraysDeep = (count: number): unknown =>
        Array.from({ length: count - 1 }).reduce<unknown>((inner) => [inner], []);
      const items = (count: number) => Array.from({ length: count }, () => 0);

      test.each([
        [
          "an array",
          { hiddenFields: { fieldIds: items(V3_REQUEST_ARRAY_MAX_ITEMS) } },
          "array_items",
          { hiddenFields: { fieldIds: items(V3_REQUEST_ARRAY_MAX_ITEMS + 1) } },
        ],
        [
          "the arrays in all",
          { lists: Array.from({ length: 50 }, () => items(V3_REQUEST_ARRAY_MAX_TOTAL_ELEMENTS / 50 - 1)) },
          "array_elements",
          { lists: Array.from({ length: 50 }, () => items(V3_REQUEST_ARRAY_MAX_TOTAL_ELEMENTS / 50)) },
        ],
        [
          "the nesting",
          { metadata: arraysDeep(V3_REQUEST_MAX_DEPTH - 2) },
          "nesting_depth",
          { metadata: arraysDeep(V3_REQUEST_MAX_DEPTH - 1) },
        ],
      ])("%s", async (_label, atLimit, limit, pastLimit) => {
        previewOk();

        const read = await importFile(formbricksFileWith(atLimit));
        expect(read.status).toBe(200);

        const refused = await importFile(formbricksFileWith(pastLimit));
        expect(refused.status).toBe(422);
        expect((await problemOf(refused)).invalid_params).toEqual([
          expect.objectContaining({ code: "file_limit_exceeded", identifier: limit }),
        ]);
      });
    });

    test("answers an empty file and a file of other content with a 422 and a 415", async () => {
      const empty = await importFile(upload(""));
      const pdf = await importFile(upload(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0xff, 0x00])));

      expect(empty.status).toBe(422);
      expect((await problemOf(empty)).invalid_params).toEqual([
        expect.objectContaining({ code: "file_unreadable" }),
      ]);
      expect(pdf.status).toBe(415);
      expect((await problemOf(pdf)).invalid_params[0].identifier).toBeUndefined();
    });
  });

  describe("the stream", () => {
    test("streams start, each stage, then done with the draft and its report", async () => {
      const response = await call();

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("application/x-ndjson");
      await expect(readEvents(response)).resolves.toEqual([
        { type: "start", requestId: "req_1" },
        { type: "progress", stage: "reading" },
        { type: "progress", stage: "ai" },
        { type: "progress", stage: "assembling" },
        { type: "done", payload: importResult.payload, report: importResult.report },
      ]);
      expect(mocks.runQsfImport).toHaveBeenCalledWith(
        expect.objectContaining({
          prepared: expect.objectContaining({ fileName: "onboarding.qsf", surveyName: "Onboarding" }),
          workspaceId: body.workspaceId,
          organizationId: "org_1",
          userId: "user_1",
          deadlineMs: SURVEY_IMPORT_DEADLINE_MS,
        })
      );
    });

    test("logs the outcome and its numbers, never the file's content", async () => {
      await (await call()).text();

      expect(mocks.log.info).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: "done",
          fileBytes: new TextEncoder().encode(JSON.stringify(body.qsf)).length,
          questionCount: 1,
          inputTokens: 1200,
          outputTokens: 300,
          durationMs: expect.any(Number),
        }),
        "Survey import finished"
      );
      expect(allLogged()).not.toContain(FILE_CONTENT_MARKER);
    });

    test("repeats the current stage as a heartbeat while the AI call runs", async () => {
      vi.useFakeTimers();
      let finish: ((result: TSurveyImportResult) => void) | undefined;
      mocks.runQsfImport.mockImplementation(
        ({ onProgress }: TRunQsfImportParams) =>
          new Promise<TSurveyImportResult>((resolve) => {
            onProgress("ai");
            finish = resolve;
          })
      );

      const response = await call();
      const events = readEvents(response);
      await vi.advanceTimersByTimeAsync(SURVEY_IMPORT_HEARTBEAT_MS * 2);
      finish?.(importResult);
      await vi.advanceTimersByTimeAsync(0);

      expect((await events).map((event) => event.type === "progress" && event.stage)).toEqual([
        false,
        "reading",
        "ai",
        "ai",
        "ai",
        false,
      ]);
    });

    test("Stop aborts the import, and the stream ends without done or an error", async () => {
      hangUntilAborted();
      const client = new AbortController();

      const response = await call(client.signal);
      const events = readEvents(response);
      await vi.waitFor(() => expect(mocks.runQsfImport).toHaveBeenCalled());
      client.abort();

      const types = (await events).map((event) => event.type);
      expect(types).not.toContain("done");
      expect(types).not.toContain("error");
      const { signal } = mocks.runQsfImport.mock.calls[0][0] as TRunQsfImportParams;
      expect(signal.aborted).toBe(true);
      expect(mocks.log.info).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: "aborted" }),
        "Survey import finished"
      );
    });

    test("a client cancelling the body aborts the import too", async () => {
      hangUntilAborted();

      const response = await call();
      await vi.waitFor(() => expect(mocks.runQsfImport).toHaveBeenCalled());
      await response.body?.cancel();

      const { signal } = mocks.runQsfImport.mock.calls[0][0] as TRunQsfImportParams;
      expect(signal.aborted).toBe(true);
    });

    test.each([1, 3])("stops at its scaled deadline (%i) and says so", async (multiplier) => {
      aiTimeoutEnv.multiplier = multiplier;
      vi.useFakeTimers();
      hangUntilAborted();

      const response = await call();
      const events = readEvents(response);
      expect(mocks.runQsfImport).toHaveBeenCalledWith(
        expect.objectContaining({ deadlineMs: SURVEY_IMPORT_DEADLINE_MS * multiplier })
      );
      await vi.advanceTimersByTimeAsync(SURVEY_IMPORT_DEADLINE_MS * multiplier - 1);
      expect(mocks.runQsfImport.mock.calls[0][0].signal.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      expect((await events).at(-1)).toMatchObject({ type: "error", code: "import_timed_out" });
      expect(mocks.log.info).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: "timed_out", errorCode: "import_timed_out" }),
        "Survey import finished"
      );
    });

    test("reports a plan that ran out of time before any question was planned as a timeout", async () => {
      mocks.runQsfImport.mockRejectedValue(new SurveyImportTimeoutError());

      const events = await readEvents(await call());

      expect(events.at(-1)).toMatchObject({ type: "error", code: "import_timed_out" });
      expect(mocks.log.info).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: "timed_out", errorCode: "import_timed_out" }),
        "Survey import finished"
      );
    });

    test("reports a mid-stream AI quota failure with Retry-After", async () => {
      mocks.runQsfImport.mockRejectedValue(new TooManyRequestsError("quota", 30));

      const events = await readEvents(await call());

      expect(events.at(-1)).toEqual(
        expect.objectContaining({ type: "error", code: "ai_quota_exceeded", retryAfter: 30 })
      );
    });

    test("reports any other failure with a fixed message, and logs where it failed, never what it said", async () => {
      // Any error can carry file content in its message — the AI SDK's validation errors carry the
      // model's output — so no error message reaches the log, only its name and frames.
      mocks.runQsfImport.mockRejectedValue(
        new Error(`Failed on ${FILE_CONTENT_MARKER}\nsecond line\n    at ${FILE_CONTENT_MARKER} (looks:1:1)`)
      );

      const events = await readEvents(await call());

      expect(events.at(-1)).toMatchObject({ type: "error", code: "import_failed" });
      expect(JSON.stringify(events)).not.toContain(FILE_CONTENT_MARKER);
      expect(mocks.log.error).toHaveBeenCalledWith(
        expect.objectContaining({
          errName: "Error",
          errStack: expect.stringMatching(/^ +at \S.*(?:\n +at \S.*)*$/),
        }),
        "Survey import failed"
      );
      expect(allLogged()).not.toContain(FILE_CONTENT_MARKER);
      expect(allLogged()).not.toContain("second line");
    });

    test("logs no frames when the message changed after the stack was taken, rather than risk a line of it", async () => {
      const error = new Error(`Failed\n    at ${FILE_CONTENT_MARKER} (looks:1:1)`);
      void error.stack; // V8 writes the header from the message as it is now.
      error.message = "rewritten";
      mocks.runQsfImport.mockRejectedValue(error);

      await (await call()).text();

      expect(mocks.log.error).toHaveBeenCalledWith(
        expect.not.objectContaining({ errStack: expect.anything() }),
        "Survey import failed"
      );
      expect(allLogged()).not.toContain(FILE_CONTENT_MARKER);
    });

    test("keeps the frames of Node's own coded errors, such as a write to a closed stream", async () => {
      // Node writes the code into the header; Vitest rewrites stacks without it, so the header is set
      // here as Node prints it for an enqueue on a closed stream.
      const closedWrite = Object.assign(new TypeError("Invalid state: Controller is already closed"), {
        code: "ERR_INVALID_STATE",
      });
      closedWrite.stack = [
        "TypeError [ERR_INVALID_STATE]: Invalid state: Controller is already closed",
        "    at ReadableStreamDefaultController.enqueue (node:internal/webstreams/readablestream:1077:13)",
        "    at emit (/app/apps/web/app/api/internal/surveys/import/lib/operations.ts:1:1)",
      ].join("\n");
      mocks.runQsfImport.mockRejectedValue(closedWrite);

      await (await call()).text();

      expect(mocks.log.error).toHaveBeenCalledWith(
        expect.objectContaining({
          errName: "TypeError",
          errStack: expect.stringContaining("operations.ts:1:1"),
        }),
        "Survey import failed"
      );
    });

    test("still reports and logs a failure whose message is not a string", async () => {
      const error = new Error("boom");
      Object.defineProperty(error, "message", { value: undefined });
      mocks.runQsfImport.mockRejectedValue(error);

      const events = await readEvents(await call());

      expect(events.at(-1)).toMatchObject({ type: "error", code: "import_failed" });
      expect(mocks.log.error).toHaveBeenCalledWith(
        expect.objectContaining({ errName: "Error" }),
        "Survey import failed"
      );
    });

    test("logs a provider error by name and status only, since its message can echo the prompt", async () => {
      mocks.runQsfImport.mockRejectedValue(
        new APICallError({
          message: `Provider rejected the prompt: ${FILE_CONTENT_MARKER}`,
          url: "https://provider.example/v1/chat",
          requestBodyValues: {},
          statusCode: 500,
        })
      );

      await (await call()).text();

      expect(mocks.log.error).toHaveBeenCalledWith(
        expect.objectContaining({ errName: "AI_APICallError", providerStatusCode: 500 }),
        "Survey import failed"
      );
      expect(allLogged()).not.toContain(FILE_CONTENT_MARKER);
    });
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AIOutputTokenLimitError } from "@formbricks/ai";
import { prisma } from "@formbricks/database";
import { OperationNotAllowedError, TooManyRequestsError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemForbidden } from "@/app/api/v3/lib/response";
import { getActionClasses } from "@/lib/actionClass/service";
import { assertOrganizationAIConfigured } from "@/lib/ai/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { createActionClass } from "@/modules/survey/editor/lib/action-class";
import {
  FIXTURE_APP_SURVEY,
  FIXTURE_LINK_SURVEY,
  FIXTURE_WORKSPACE_ID,
} from "@/modules/survey/export/__fixtures__/surveys";
import { buildSurveyExportEnvelope } from "@/modules/survey/export/build-export-envelope";
import { documentLane } from "@/modules/survey/import/lanes/document";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import { ZV3SurveyImportConvertBody } from "../schemas";
import { convertImportFile } from "./convert-import";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() })),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));
vi.mock("@formbricks/database", () => ({ prisma: { language: { findMany: vi.fn() } } }));
vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: vi.fn() }));
vi.mock("@/lib/actionClass/service", () => ({ getActionClasses: vi.fn() }));
vi.mock("@/modules/survey/editor/lib/action-class", () => ({ createActionClass: vi.fn() }));
vi.mock("@/modules/survey/lib/permission", () => ({ getExternalUrlsPermission: vi.fn() }));
vi.mock("@/modules/survey/import/lanes/document", () => ({ documentLane: vi.fn() }));
vi.mock("@/lib/ai/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/service")>()),
  assertOrganizationAIConfigured: vi.fn(),
}));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  WEBAPP_URL: "https://app.formbricks.com",
}));

const requestId = "req_convert_1";
const instance = "/api/v3/surveys/import/convert";
const authResult = { workspaceId: FIXTURE_WORKSPACE_ID, organizationId: "org_1" };
const authentication = {
  user: { id: "user_1", email: "user@example.com", name: "User" },
  expires: "2026-12-01",
} as unknown as Parameters<typeof convertImportFile>[0]["authentication"];

function envelopeBytes(survey: typeof FIXTURE_LINK_SURVEY): Buffer {
  const result = buildSurveyExportEnvelope(survey, {
    appVersion: "6.2.0",
    publicUrl: "https://source.example",
  });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return Buffer.from(JSON.stringify(result.data));
}

function body(fileName: string, bytes: Buffer, mimeType = "application/octet-stream") {
  return ZV3SurveyImportConvertBody.parse({
    fields: { workspaceId: FIXTURE_WORKSPACE_ID },
    files: [{ name: "file", fileName, mimeType, bytes }],
  });
}

describe("convertImportFile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(authResult);
    vi.mocked(prisma.language.findMany).mockResolvedValue([] as never);
    vi.mocked(getActionClasses).mockResolvedValue([]);
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(true);
    vi.mocked(assertOrganizationAIConfigured).mockResolvedValue({} as never);
    vi.mocked(applyRateLimit).mockResolvedValue({} as never);
  });

  test("converts a .formbricks.json upload through the lossless lane without persisting", async () => {
    const response = await convertImportFile({
      body: body("in-app.formbricks.json", envelopeBytes(FIXTURE_APP_SURVEY), "application/json"),
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.source).toEqual({
      lane: "lossless",
      kind: "formbricks-export",
      fileName: "in-app.formbricks.json",
    });
    expect(json.data.validation.valid).toBe(true);
    expect(json.data.document).toMatchObject({ type: "app", status: "draft" });
    expect(json.data.references.actionClasses).toHaveLength(2);
    expect(json.data.report.issues.map((issue: { code: string }) => issue.code)).toContain(
      "trigger_would_be_created"
    );
    expect(createActionClass).not.toHaveBeenCalled();
  });

  test("a raw v3 document renamed to .txt is still detected by content", async () => {
    const response = await convertImportFile({
      body: body(
        "notes.txt",
        Buffer.from(
          JSON.stringify({
            name: "Doc",
            blocks: [
              {
                name: "B",
                elements: [{ id: "q", type: "openText", headline: { "en-US": "Q?" }, required: false }],
              },
            ],
          })
        )
      ),
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.source.kind).toBe("v3-document");
    expect(json.data.references).toBeNull();
  });

  test("a file the lane cannot read answers 200 with document null and the reasons in the report", async () => {
    const response = await convertImportFile({
      body: body(
        "old.json",
        Buffer.from(JSON.stringify({ name: "Old", blocks: [], questions: [{ id: "q1" }] }))
      ),
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.document).toBeNull();
    expect(json.data.report.issues[0]).toMatchObject({
      severity: "error",
      code: "legacy_questions_unsupported",
    });
  });

  test.each([
    ["survey.doc", Buffer.from("\xd0\xcf\x11\xe0 legacy"), "legacy_office_format", "Save the file as .docx"],
    ["photo.png", Buffer.from("\x89PNG..."), "unsupported_source", "not supported"],
    ["empty.json", Buffer.alloc(0), "unsupported_source", "empty"],
    ["broken.json", Buffer.from("{ nope"), "unsupported_source", "not valid JSON"],
  ])("rejects %s with 422 and code %s", async (fileName, bytes, code, detail) => {
    const response = await convertImportFile({
      body: body(fileName, bytes),
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(422);
    const json = await response.json();
    expect(json.code).toBe(code);
    expect(json.detail).toContain(detail);
    expect(json.invalid_params[0].name).toBe("file");
  });

  test("converts a Qualtrics .qsf through the structured lane and reports its logic", async () => {
    // vitest runs with apps/web as cwd; the QSF fixtures live next to their lane.
    const qsf = readFileSync(
      join(process.cwd(), "modules/survey/import/lanes/qsf/__fixtures__/logic-skip-display-branch.qsf")
    );

    const response = await convertImportFile({
      body: body("survey.qsf", qsf),
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.source).toMatchObject({ lane: "structured", kind: "qsf" });
    expect(json.data.validation.valid, JSON.stringify(json.data.validation)).toBe(true);
    expect(json.data.document).toMatchObject({ type: "link", status: "draft", name: "Logic showcase" });
    expect(json.data.report.summary).toMatchObject({ logicRules: 0, logicRulesReported: 6, hiddenFields: 1 });
    expect(
      json.data.report.issues.filter((issue: { code: string }) => issue.code === "logic_dropped")
    ).toHaveLength(7);
    expect(json.data.report.issues.map((issue: { code: string }) => issue.code)).not.toContain(
      "settings_not_exported"
    );
  });

  describe("AI lane", () => {
    const docx = () =>
      body(
        "questions.docx",
        readFileSync(
          join(process.cwd(), "modules/survey/import/lanes/document/__fixtures__/survey-numbered-lists.docx")
        )
      );
    const aiCandidate = {
      document: {
        name: "From a document",
        type: "link",
        status: "draft",
        defaultLanguage: "en-US",
        languages: [{ code: "en-US", default: true, enabled: true }],
        welcomeCard: { enabled: false },
        blocks: [
          {
            id: "b1",
            name: "Block",
            elements: [{ id: "q1", type: "openText", headline: { "en-US": "How was it?" }, required: false }],
          },
        ],
        endings: [{ id: "e1", type: "endScreen", headline: { "en-US": "Thanks" } }],
        hiddenFields: { enabled: false },
        variables: [],
      },
      issues: [],
      source: {
        lane: "ai" as const,
        kind: "docx" as const,
        fileName: "questions.docx",
        chunks: 2,
        detectedLanguages: [{ code: "en-US", confidence: 0.9 }],
      },
    };

    test("an organization without AI gets 403 before the file is read", async () => {
      vi.mocked(assertOrganizationAIConfigured).mockRejectedValue(
        new OperationNotAllowedError("ai_features_not_enabled")
      );

      const response = await convertImportFile({ body: docx(), authentication, requestId, instance });

      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("ai_features_not_enabled");
      expect(documentLane).not.toHaveBeenCalled();
      expect(applyRateLimit).not.toHaveBeenCalled();
    });

    test("an entitled organization gets the AI lane's document, source and a PostHog event", async () => {
      vi.mocked(documentLane).mockResolvedValue(aiCandidate);

      const response = await convertImportFile({ body: docx(), authentication, requestId, instance });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.source).toMatchObject({ lane: "ai", kind: "docx", chunks: 2 });
      expect(json.data.document).toMatchObject({ name: "From a document" });
      expect(json.data.validation.valid).toBe(true);
      expect(applyRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({ namespace: "api:v3:surveys:generate" }),
        "user_1"
      );
      expect(capturePostHogEvent).toHaveBeenCalledWith(
        "user_1",
        "ai_survey_imported",
        expect.objectContaining({
          source_kind: "docx",
          chunk_count: 2,
          question_count: 1,
          language_count: 1,
        }),
        expect.objectContaining({ workspaceId: FIXTURE_WORKSPACE_ID })
      );
    });

    test("the output token limit maps to 422 ai_output_too_long", async () => {
      vi.mocked(documentLane).mockRejectedValue(new AIOutputTokenLimitError());

      const response = await convertImportFile({ body: docx(), authentication, requestId, instance });

      expect(response.status).toBe(422);
      expect((await response.json()).code).toBe("ai_output_too_long");
    });

    test("the shared AI budget answers 429 with Retry-After", async () => {
      vi.mocked(applyRateLimit).mockRejectedValue(new TooManyRequestsError("slow down", 42));

      const response = await convertImportFile({ body: docx(), authentication, requestId, instance });

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("42");
      expect(documentLane).not.toHaveBeenCalled();
    });

    test("an unexpected provider failure is a 502, not a 500", async () => {
      vi.mocked(documentLane).mockRejectedValue(new Error("provider down"));

      const response = await convertImportFile({ body: docx(), authentication, requestId, instance });

      expect(response.status).toBe(502);
    });

    test("deterministic lanes never touch the AI gate", async () => {
      vi.mocked(assertOrganizationAIConfigured).mockRejectedValue(
        new OperationNotAllowedError("ai_features_not_enabled")
      );
      const qsf = readFileSync(
        join(process.cwd(), "modules/survey/import/lanes/qsf/__fixtures__/simple.qsf")
      );

      const response = await convertImportFile({
        body: body("survey.qsf", qsf),
        authentication,
        requestId,
        instance,
      });

      expect(response.status).toBe(200);
      expect(assertOrganizationAIConfigured).not.toHaveBeenCalled();
      expect(applyRateLimit).not.toHaveBeenCalled();
    });
  });

  test("returns the authorization response before touching the file", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(problemForbidden(requestId, "nope", instance));

    const response = await convertImportFile({
      body: body("x.json", envelopeBytes(FIXTURE_LINK_SURVEY)),
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(403);
    expect(prisma.language.findMany).not.toHaveBeenCalled();
  });
});

describe("ZV3SurveyImportConvertBody", () => {
  test("requires exactly one part named file and a cuid2 workspaceId", () => {
    const file = { name: "file", fileName: "a.json", mimeType: "application/json", bytes: Buffer.from("{}") };
    expect(
      ZV3SurveyImportConvertBody.safeParse({ fields: { workspaceId: FIXTURE_WORKSPACE_ID }, files: [file] })
        .success
    ).toBe(true);
    expect(
      ZV3SurveyImportConvertBody.safeParse({ fields: { workspaceId: FIXTURE_WORKSPACE_ID }, files: [] })
        .success
    ).toBe(false);
    expect(
      ZV3SurveyImportConvertBody.safeParse({
        fields: { workspaceId: FIXTURE_WORKSPACE_ID },
        files: [file, file],
      }).success
    ).toBe(false);
    expect(
      ZV3SurveyImportConvertBody.safeParse({
        fields: { workspaceId: FIXTURE_WORKSPACE_ID },
        files: [{ ...file, name: "upload" }],
      }).success
    ).toBe(false);
    expect(
      ZV3SurveyImportConvertBody.safeParse({ fields: { workspaceId: "NOT-A-CUID!" }, files: [file] }).success
    ).toBe(false);
    expect(
      ZV3SurveyImportConvertBody.safeParse({
        fields: { workspaceId: FIXTURE_WORKSPACE_ID, extra: "x" },
        files: [file],
      }).success
    ).toBe(false);
  });
});

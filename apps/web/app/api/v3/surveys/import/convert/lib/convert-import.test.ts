import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemForbidden } from "@/app/api/v3/lib/response";
import { getActionClasses } from "@/lib/actionClass/service";
import { createActionClass } from "@/modules/survey/editor/lib/action-class";
import {
  FIXTURE_APP_SURVEY,
  FIXTURE_LINK_SURVEY,
  FIXTURE_WORKSPACE_ID,
} from "@/modules/survey/export/__fixtures__/surveys";
import { buildSurveyExportEnvelope } from "@/modules/survey/export/build-export-envelope";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import { ZV3SurveyImportConvertBody } from "../schemas";
import { convertImportFile } from "./convert-import";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() })) },
}));
vi.mock("@formbricks/database", () => ({ prisma: { language: { findMany: vi.fn() } } }));
vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: vi.fn() }));
vi.mock("@/lib/actionClass/service", () => ({ getActionClasses: vi.fn() }));
vi.mock("@/modules/survey/editor/lib/action-class", () => ({ createActionClass: vi.fn() }));
vi.mock("@/modules/survey/lib/permission", () => ({ getExternalUrlsPermission: vi.fn() }));
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

  test("answers 400 lane_not_available for a kind whose lane has not shipped", async () => {
    const response = await convertImportFile({
      body: body("questions.csv", Buffer.from("Question;Type\nHow?;openText"), "text/csv"),
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.code).toBe("lane_not_available");
    expect(json.invalid_params[0]).toMatchObject({ name: "file", reason: expect.stringContaining("csv") });
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

import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemForbidden } from "@/app/api/v3/lib/response";
import { createV3SurveyResponse } from "@/app/api/v3/surveys/lib/operations";
import { getActionClasses } from "@/lib/actionClass/service";
import { createActionClass } from "@/modules/survey/editor/lib/action-class";
import {
  FIXTURE_APP_SURVEY,
  FIXTURE_LINK_SURVEY,
  FIXTURE_WORKSPACE_ID,
} from "@/modules/survey/export/__fixtures__/surveys";
import { buildSurveyExportEnvelope } from "@/modules/survey/export/build-export-envelope";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import { ZV3SurveyImportBody } from "../schemas";
import { importV3Survey } from "./import-survey";

vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn(async () => ({})) }));
vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() })) },
}));

vi.mock("@formbricks/database", () => ({
  prisma: { language: { findMany: vi.fn() }, survey: { create: vi.fn() } },
}));

vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: vi.fn() }));
vi.mock("@/app/api/v3/lib/audit", () => ({
  buildV3AuditLog: vi.fn(() => ({ action: "created", targetType: "survey" })),
  queueV3AuditLog: vi.fn(),
}));
vi.mock("@/app/api/v3/surveys/lib/operations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/api/v3/surveys/lib/operations")>()),
  createV3SurveyResponse: vi.fn(),
}));
vi.mock("@/lib/actionClass/service", () => ({ getActionClasses: vi.fn() }));
vi.mock("@/modules/survey/editor/lib/action-class", () => ({ createActionClass: vi.fn() }));
vi.mock("@/modules/survey/lib/permission", () => ({ getExternalUrlsPermission: vi.fn() }));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  WEBAPP_URL: "https://app.formbricks.com",
}));

const requestId = "req_import_1";
const instance = "/api/v3/surveys/import";
const authResult = { workspaceId: FIXTURE_WORKSPACE_ID, organizationId: "org_1" };
const sessionAuthentication = {
  user: { id: "user_1", email: "user@example.com", name: "User" },
  expires: "2026-12-01",
} as unknown as Parameters<typeof importV3Survey>[0]["authentication"];
const req = new Request("https://app.formbricks.com/api/v3/surveys/import", { method: "POST" });

function envelopeOf(survey: typeof FIXTURE_LINK_SURVEY) {
  const result = buildSurveyExportEnvelope(survey, {
    appVersion: "6.2.0",
    publicUrl: "https://source.example",
  });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return JSON.parse(JSON.stringify(result.data)) as Record<string, unknown>;
}

function parseBody(body: unknown) {
  return ZV3SurveyImportBody.parse(body);
}

describe("importV3Survey", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(authResult);
    vi.mocked(prisma.language.findMany).mockResolvedValue([{ code: "en-US" }] as never);
    vi.mocked(getActionClasses).mockResolvedValue([]);
    vi.mocked(createActionClass).mockResolvedValue({ id: "claacreated000000000000001" } as never);
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(true);
    vi.mocked(createV3SurveyResponse).mockResolvedValue(
      Response.json(
        { data: { id: "clsvnew0000000000000000001", name: "Imported" } },
        { status: 201, headers: { Location: "/api/v3/surveys/clsvnew0000000000000000001" } }
      )
    );
  });

  test("dryRun returns document, report and validation and writes nothing", async () => {
    const response = await importV3Survey({
      req,
      body: parseBody({
        workspaceId: FIXTURE_WORKSPACE_ID,
        export: envelopeOf(FIXTURE_APP_SURVEY),
        options: { dryRun: true },
      }),
      authentication: sessionAuthentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.validation).toEqual({ valid: true, invalid_params: [] });
    expect(body.data.document).toMatchObject({ type: "app", status: "draft" });
    expect(body.data.document).not.toHaveProperty("workspaceId");
    expect(body.data.report.source).toEqual({ lane: "lossless", kind: "formbricks-export" });
    expect(body.data.report.issues.map((issue: { code: string }) => issue.code)).toContain(
      "trigger_would_be_created"
    );
    expect(createActionClass).not.toHaveBeenCalled();
    expect(createV3SurveyResponse).not.toHaveBeenCalled();
    expect(prisma.survey.create).not.toHaveBeenCalled();
  });

  test("creates through the shared v3 create path with createdFrom import and returns survey + report", async () => {
    const response = await importV3Survey({
      req,
      body: parseBody({
        workspaceId: FIXTURE_WORKSPACE_ID,
        export: envelopeOf(FIXTURE_LINK_SURVEY),
        options: { name: "Renamed" },
      }),
      authentication: sessionAuthentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe("/api/v3/surveys/clsvnew0000000000000000001");
    const body = await response.json();
    expect(body.data.survey).toEqual({ id: "clsvnew0000000000000000001", name: "Imported" });
    expect(body.data.report.issues.map((issue: { code: string }) => issue.code)).toContain(
      "settings_not_exported"
    );

    expect(createV3SurveyResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        authResult,
        createdFrom: "import",
        createOptions: { skipExternalUrlPermissionCheck: true },
        body: expect.objectContaining({
          workspaceId: FIXTURE_WORKSPACE_ID,
          name: "Renamed",
          status: "draft",
        }),
        analyticsProperties: expect.objectContaining({
          import_source: "formbricks-export",
          import_lane: "lossless",
          import_ai_used: false,
          import_chunk_count: 0,
        }),
        auditLog: expect.objectContaining({ action: "created" }),
      })
    );
  });

  test("accepts a raw document with references, creating the referenced action class", async () => {
    const envelope = envelopeOf(FIXTURE_APP_SURVEY);

    const response = await importV3Survey({
      req,
      body: parseBody({
        workspaceId: FIXTURE_WORKSPACE_ID,
        document: envelope.survey,
        references: envelope.references,
      }),
      authentication: sessionAuthentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(201);
    expect(createActionClass).toHaveBeenCalledTimes(2);
    const createBody = vi.mocked(createV3SurveyResponse).mock.calls[0][0].body;
    expect(createBody.distribution?.triggers).toEqual([
      { actionClassId: "claacreated000000000000001" },
      { actionClassId: "claacreated000000000000001" },
    ]);
  });

  test("answers 422 with invalid_params and the report when the document cannot be imported", async () => {
    const envelope = envelopeOf(FIXTURE_LINK_SURVEY);
    const survey = envelope.survey as Record<string, unknown>;
    const blocks = survey.blocks as { elements: Record<string, unknown>[] }[];
    blocks[0].elements[0].type = "hologram";

    const response = await importV3Survey({
      req,
      body: parseBody({ workspaceId: FIXTURE_WORKSPACE_ID, export: envelope }),
      authentication: sessionAuthentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.invalid_params).toEqual([
      { name: "blocks.0.elements.0.type", reason: expect.stringContaining("hologram") },
    ]);
    expect(body.details.report.issues).toContainEqual(
      expect.objectContaining({ severity: "error", code: "unknown_element" })
    );
    expect(createV3SurveyResponse).not.toHaveBeenCalled();
  });

  test("strips an extensions block and still creates, with a warning in the report", async () => {
    const envelope = { ...envelopeOf(FIXTURE_LINK_SURVEY), extensions: { styling: {} } };

    const response = await importV3Survey({
      req,
      body: parseBody({ workspaceId: FIXTURE_WORKSPACE_ID, export: envelope }),
      authentication: sessionAuthentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.report.issues).toContainEqual(
      expect.objectContaining({ code: "unknown_field_stripped", path: "extensions" })
    );
  });

  test("returns the authorization response for a workspace the caller cannot write", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(problemForbidden(requestId, "nope", instance));

    const response = await importV3Survey({
      req,
      body: parseBody({ workspaceId: FIXTURE_WORKSPACE_ID, document: { name: "x", blocks: [] } }),
      authentication: sessionAuthentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(403);
    expect(prisma.language.findMany).not.toHaveBeenCalled();
  });

  test("passes a non-201 create response through unchanged", async () => {
    vi.mocked(createV3SurveyResponse).mockResolvedValue(
      Response.json({ title: "Forbidden" }, { status: 403 })
    );

    const response = await importV3Survey({
      req,
      body: parseBody({ workspaceId: FIXTURE_WORKSPACE_ID, export: envelopeOf(FIXTURE_LINK_SURVEY) }),
      authentication: sessionAuthentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(403);
  });
});

describe("ZV3SurveyImportBody", () => {
  test("requires exactly one of export or document", () => {
    expect(ZV3SurveyImportBody.safeParse({ workspaceId: FIXTURE_WORKSPACE_ID }).success).toBe(false);
    expect(
      ZV3SurveyImportBody.safeParse({ workspaceId: FIXTURE_WORKSPACE_ID, export: {}, document: {} }).success
    ).toBe(false);
    expect(ZV3SurveyImportBody.safeParse({ workspaceId: FIXTURE_WORKSPACE_ID, document: {} }).success).toBe(
      true
    );
    expect(
      ZV3SurveyImportBody.safeParse({
        workspaceId: FIXTURE_WORKSPACE_ID,
        document: {},
        options: { dryRun: "yes" },
      }).success
    ).toBe(false);
  });
});

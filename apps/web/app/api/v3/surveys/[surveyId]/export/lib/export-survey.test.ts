import { beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError } from "@formbricks/types/errors";
import { problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import { getAuthorizedV3Survey } from "@/app/api/v3/surveys/authorization";
import { capturePostHogEvent } from "@/lib/posthog";
import {
  FIXTURE_APP_SURVEY,
  FIXTURE_EMPTY_SURVEY,
  FIXTURE_LINK_SURVEY,
  FIXTURE_WORKSPACE_ID,
} from "@/modules/survey/export/__fixtures__/surveys";
import { exportV3Survey } from "./export-survey";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

vi.mock("@/app/api/v3/surveys/authorization", () => ({
  getAuthorizedV3Survey: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: vi.fn(),
}));

vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  APP_VERSION: "6.2.0",
  WEBAPP_URL: "https://app.formbricks.com",
}));

const requestId = "req_export_1";
const instance = `/api/v3/surveys/${FIXTURE_LINK_SURVEY.id}/export`;
const authResult = { workspaceId: FIXTURE_WORKSPACE_ID, organizationId: "org_1" };
const apiKeyAuthentication = {
  type: "apiKey",
  apiKeyId: "api_key_1",
  organizationId: "org_1",
} as unknown as Parameters<typeof exportV3Survey>[0]["authentication"];
const sessionAuthentication = {
  user: { id: "user_1", email: "user@example.com", name: "User" },
  expires: "2026-12-01",
} as unknown as Parameters<typeof exportV3Survey>[0]["authentication"];

describe("exportV3Survey", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({
      survey: FIXTURE_LINK_SURVEY,
      authResult,
      response: null,
    } as unknown as Awaited<ReturnType<typeof getAuthorizedV3Survey>>);
  });

  test("returns the envelope under data with no-store caching for API-key callers", async () => {
    const response = await exportV3Survey({
      surveyId: FIXTURE_LINK_SURVEY.id,
      authentication: apiKeyAuthentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(getAuthorizedV3Survey).toHaveBeenCalledWith({
      surveyId: FIXTURE_LINK_SURVEY.id,
      authentication: apiKeyAuthentication,
      access: "read",
      requestId,
      instance,
    });

    const body = await response.json();
    expect(Object.keys(body.data)).toEqual(["formbricks", "survey", "references"]);
    expect(body.data.formbricks).toMatchObject({
      exportFormat: 1,
      appVersion: "6.2.0",
      source: {
        url: "https://app.formbricks.com",
        workspaceId: FIXTURE_WORKSPACE_ID,
        surveyId: FIXTURE_LINK_SURVEY.id,
      },
    });
    expect(body.data.survey.languages).toHaveLength(2);
    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });

  test("fills the audit log and captures survey_exported for session users", async () => {
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({
      survey: FIXTURE_APP_SURVEY,
      authResult,
      response: null,
    } as unknown as Awaited<ReturnType<typeof getAuthorizedV3Survey>>);
    const auditLog = { action: "exported", targetType: "survey" } as unknown as TV3AuditLog;

    const response = await exportV3Survey({
      surveyId: FIXTURE_APP_SURVEY.id,
      authentication: sessionAuthentication,
      requestId,
      instance,
      auditLog,
    });

    expect(response.status).toBe(200);
    expect(auditLog).toMatchObject({
      targetId: FIXTURE_APP_SURVEY.id,
      organizationId: "org_1",
      newObject: { exportFormat: 1, workspaceId: FIXTURE_WORKSPACE_ID },
    });
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      "user_1",
      "survey_exported",
      {
        survey_id: FIXTURE_APP_SURVEY.id,
        survey_type: "app",
        workspace_id: FIXTURE_WORKSPACE_ID,
        organization_id: "org_1",
        question_count: 17,
        language_count: 2,
      },
      { organizationId: "org_1", workspaceId: FIXTURE_WORKSPACE_ID }
    );
  });

  test("returns the authorization response when the caller cannot read the workspace", async () => {
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({
      survey: null,
      authResult: null,
      response: problemForbidden(requestId, "nope", instance),
    } as unknown as Awaited<ReturnType<typeof getAuthorizedV3Survey>>);

    const response = await exportV3Survey({
      surveyId: FIXTURE_LINK_SURVEY.id,
      authentication: apiKeyAuthentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(403);
    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });

  test("answers 422 with invalid_params when the builder refuses the survey", async () => {
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({
      survey: FIXTURE_EMPTY_SURVEY,
      authResult,
      response: null,
    } as unknown as Awaited<ReturnType<typeof getAuthorizedV3Survey>>);

    const response = await exportV3Survey({
      surveyId: FIXTURE_EMPTY_SURVEY.id,
      authentication: sessionAuthentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.invalid_params).toEqual([
      { name: "survey.blocks", reason: expect.stringContaining("Empty surveys cannot be exported") },
    ]);
    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });

  test("maps database errors to 500 without leaking details", async () => {
    vi.mocked(getAuthorizedV3Survey).mockRejectedValue(new DatabaseError("boom"));

    const response = await exportV3Survey({
      surveyId: FIXTURE_LINK_SURVEY.id,
      authentication: apiKeyAuthentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(500);
    expect((await response.json()).detail).toBe("An unexpected error occurred.");
  });
});

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  getAuthorizedV3Survey: vi.fn(),
  exportFormbricksFile: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/app/lib/api/api-error-reporter", () => ({ reportApiError: vi.fn() }));
vi.mock("@/app/api/v3/surveys/authorization", () => ({ getAuthorizedV3Survey: mocks.getAuthorizedV3Survey }));
vi.mock("@/modules/survey/formbricks-file/export", () => ({
  exportFormbricksFile: mocks.exportFormbricksFile,
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({
    action,
    targetType,
    userId: "unknown",
    targetId: "unknown",
    organizationId: "unknown",
    status: "failure",
    userType: "api",
  })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })), error: vi.fn() },
}));

const SURVEY_ID = "clsurvey0000000000000001";
const ORGANIZATION_ID = "clorganization0000000001";
const WORKSPACE_ID = "clworkspace0000000000001";
const FILE = { $schema: "https://example.com/schema.json", survey: { name: "Kundenzufriedenheit Ü" } };

const get = (query: string, surveyId = SURVEY_ID) =>
  GET(new NextRequest(`http://localhost/api/internal/surveys/${surveyId}/export${query}`), {
    params: Promise.resolve({ surveyId }),
  });

describe("GET /api/internal/surveys/{surveyId}/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "user_1" }, expires: "2099-01-01" });
    mocks.applyRateLimit.mockResolvedValue(undefined);
    mocks.queueAuditEvent.mockResolvedValue(undefined);
    mocks.getAuthorizedV3Survey.mockResolvedValue({
      survey: { id: SURVEY_ID, workspaceId: WORKSPACE_ID, name: "Kundenzufriedenheit Ü" },
      authResult: { organizationId: ORGANIZATION_ID, workspaceId: WORKSPACE_ID },
      response: null,
      visibility: {},
    });
    mocks.exportFormbricksFile.mockResolvedValue(FILE);
  });

  test("sends the file's bytes as an attachment, not cached, with its length, and audits the export", async () => {
    const response = await get("?format=json");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename="Kundenzufriedenheit U.formbricks.json"; filename*=UTF-8''Kundenzufriedenheit%20%C3%9C.formbricks.json`
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Request-Id")).toBeTruthy();

    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(response.headers.get("Content-Length")).toBe(String(bytes.byteLength));
    expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual(FILE);

    expect(mocks.getAuthorizedV3Survey).toHaveBeenCalledWith(
      expect.objectContaining({ surveyId: SURVEY_ID, access: "read" })
    );
    expect(mocks.queueAuditEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        action: "exported",
        targetType: "survey",
        targetId: SURVEY_ID,
        organizationId: ORGANIZATION_ID,
        userId: "user_1",
        status: "success",
      })
    );
  });

  test.each([
    ["an unknown format", "?format=xlsx"],
    ["no format", ""],
    ["an unknown parameter", "?format=json&download=1"],
  ])("answers %s with 400 and exports nothing", async (_case, query) => {
    const response = await get(query);

    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toContain("application/problem+json");
    expect(mocks.getAuthorizedV3Survey).not.toHaveBeenCalled();
    expect(mocks.exportFormbricksFile).not.toHaveBeenCalled();
  });

  test("names `format` in the 400 for an unknown format", async () => {
    const body = await (await get("?format=xlsx")).json();
    expect(body.invalid_params).toEqual([expect.objectContaining({ name: "format" })]);
  });

  test("passes a refusal through without a file, auditing it under no organization", async () => {
    const forbidden = new Response(JSON.stringify({ status: 403 }), { status: 403 });
    mocks.getAuthorizedV3Survey.mockResolvedValue({
      survey: null,
      authResult: null,
      response: forbidden,
    });

    const response = await get("?format=json");

    expect(response.status).toBe(403);
    expect(response.headers.get("Content-Disposition")).toBeNull();
    expect(mocks.exportFormbricksFile).not.toHaveBeenCalled();
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "exported", organizationId: "unknown", status: "failure" })
    );
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await get("?format=json");

    expect(response.status).toBe(401);
    expect(mocks.getAuthorizedV3Survey).not.toHaveBeenCalled();
  });
});

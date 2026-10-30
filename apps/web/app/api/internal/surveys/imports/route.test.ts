import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { SURVEY_IMPORT_MAX_CREATE_BODY_BYTES } from "@/modules/survey/import/limits";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  authenticateRequest: vi.fn(),
  applyRateLimit: vi.fn(),
  createSurveyImport: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: mocks.authenticateRequest }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/app/lib/api/api-error-reporter", () => ({ reportApiError: vi.fn() }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("./lib/operations", () => ({ createSurveyImport: mocks.createSurveyImport }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })), error: vi.fn() },
}));

const URL_PATH = "http://localhost/api/internal/surveys/imports";
const WORKSPACE_ID = "clxx1234567890123456789012";

const bodyOf = (survey: Record<string, unknown> = { name: "Onboarding" }) => ({
  workspaceId: WORKSPACE_ID,
  survey,
  references: { actionClasses: [], attributeKeys: [], embeddedFields: [] },
});

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new NextRequest(URL_PATH, {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "Content-Type": "application/json", "Idempotency-Key": '"key-1"', ...headers },
    }),
    {} as never
  );

/** A body of exactly `bytes` bytes, padded inside the survey so it stays valid JSON. */
const bodyOfSize = (bytes: number): string => {
  const empty = JSON.stringify(bodyOf({ name: "Onboarding", padding: "" }));
  return JSON.stringify(bodyOf({ name: "Onboarding", padding: "x".repeat(bytes - empty.length) }));
};

describe("POST /api/internal/surveys/imports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "user_1" }, expires: "2099-01-01" });
    mocks.applyRateLimit.mockResolvedValue(undefined);
    mocks.queueAuditEvent.mockResolvedValue(undefined);
    mocks.createSurveyImport.mockResolvedValue(
      Response.json({ data: { id: "clsurvey0000000000000001" } }, { status: 201 })
    );
  });

  test("hands the parsed body and the request to the operation, charged to the default v3 bucket", async () => {
    const response = await post(bodyOf());

    expect(response.status).toBe(201);
    expect(mocks.createSurveyImport).toHaveBeenCalledWith(
      expect.objectContaining({ body: bodyOf(), auditLog: expect.objectContaining({ action: "created" }) })
    );
    const [[{ req }]] = mocks.createSurveyImport.mock.calls as [[{ req: Request }]];
    expect(req.headers.get("Idempotency-Key")).toBe('"key-1"');
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.api.v3, "user_1");
  });

  test("takes a session only: an API key is refused before anything runs", async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.authenticateRequest.mockResolvedValue({ type: "apiKey", apiKeyId: "key_1" });

    const response = await post(bodyOf(), { "x-api-key": "fb_key" });

    expect(response.status).toBe(401);
    expect(mocks.createSurveyImport).not.toHaveBeenCalled();
  });

  test("refuses a body with an unknown key, or without a survey, naming the field", async () => {
    const unknownKey = await post({ ...bodyOf(), surveyId: "clsurvey0000000000000001" });
    expect(unknownKey.status).toBe(400);
    expect(await unknownKey.json()).toMatchObject({ invalid_params: [{ name: "surveyId" }] });

    const { survey: _survey, ...withoutSurvey } = bodyOf();
    const missing = await post(withoutSurvey);
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ invalid_params: [{ name: "survey" }] });
    expect(mocks.createSurveyImport).not.toHaveBeenCalled();
  });

  test("reads a body of exactly the create limit, and answers one byte more with a 413", async () => {
    const atLimit = await post(bodyOfSize(SURVEY_IMPORT_MAX_CREATE_BODY_BYTES));
    expect(atLimit.status).toBe(201);

    const overLimit = await post(bodyOfSize(SURVEY_IMPORT_MAX_CREATE_BODY_BYTES + 1));
    expect(overLimit.status).toBe(413);
    expect(mocks.createSurveyImport).toHaveBeenCalledTimes(1);
  });
});

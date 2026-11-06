import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { SURVEY_IMPORT_MAX_CREATE_BODY_BYTES } from "@/modules/survey/import/limits";
import { PUT } from "./route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  authenticateRequest: vi.fn(),
  applyRateLimit: vi.fn(),
  updateSurveyContent: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: mocks.authenticateRequest }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/app/lib/api/api-error-reporter", () => ({ reportApiError: vi.fn() }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("./lib/operations", () => ({ updateSurveyContent: mocks.updateSurveyContent }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })), error: vi.fn() },
}));

const SURVEY_ID = "clsurvey0000000000000001";
const URL_PATH = `http://localhost/api/internal/surveys/${SURVEY_ID}/content`;

const bodyOf = (survey: Record<string, unknown> = { name: "Onboarding" }) => ({
  survey,
  references: { actionClasses: [], attributeKeys: [], embeddedFields: [] },
  updatedAt: "2026-10-30T12:00:00.000Z",
  triggers: "file",
});

const put = (body: unknown, { surveyId = SURVEY_ID, headers = {} as Record<string, string> } = {}) =>
  PUT(
    new NextRequest(URL_PATH, {
      method: "PUT",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "Content-Type": "application/json", ...headers },
    }),
    { params: Promise.resolve({ surveyId }) } as never
  );

/** A body of exactly `bytes` bytes, padded inside the survey so it stays valid JSON. */
const bodyOfSize = (bytes: number): string => {
  const empty = JSON.stringify(bodyOf({ name: "Onboarding", padding: "" }));
  return JSON.stringify(bodyOf({ name: "Onboarding", padding: "x".repeat(bytes - empty.length) }));
};

describe("PUT /api/internal/surveys/{surveyId}/content", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "user_1" }, expires: "2099-01-01" });
    mocks.applyRateLimit.mockResolvedValue(undefined);
    mocks.queueAuditEvent.mockResolvedValue(undefined);
    mocks.updateSurveyContent.mockResolvedValue(
      Response.json({ data: { id: SURVEY_ID, updatedAt: "2026-10-30T12:00:01.000Z" } })
    );
  });

  test("hands the survey id and parsed body to the operation, audited as updated, charged to the default v3 bucket", async () => {
    const response = await put(bodyOf());

    expect(response.status).toBe(200);
    expect(mocks.updateSurveyContent).toHaveBeenCalledWith(
      expect.objectContaining({
        surveyId: SURVEY_ID,
        body: bodyOf(),
        auditLog: expect.objectContaining({ action: "updated", targetType: "survey" }),
      })
    );
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.api.v3, "user_1");
  });

  test("takes a session only: an API key is refused before anything runs", async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.authenticateRequest.mockResolvedValue({ type: "apiKey", apiKeyId: "key_1" });

    const response = await put(bodyOf(), { headers: { "x-api-key": "fb_key" } });

    expect(response.status).toBe(401);
    expect(mocks.updateSurveyContent).not.toHaveBeenCalled();
  });

  test("refuses a body without its precondition, with another triggers choice or an unknown key, naming the field", async () => {
    const { updatedAt: _updatedAt, ...withoutUpdatedAt } = bodyOf();
    const cases: [unknown, string][] = [
      [withoutUpdatedAt, "updatedAt"],
      [{ ...bodyOf(), updatedAt: "yesterday" }, "updatedAt"],
      [{ ...bodyOf(), triggers: "both" }, "triggers"],
      [{ ...bodyOf(), name: "Renamed" }, "name"],
    ];

    for (const [body, field] of cases) {
      const response = await put(body);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ invalid_params: [{ name: field }] });
    }
    expect(mocks.updateSurveyContent).not.toHaveBeenCalled();
  });

  test("refuses a survey id that is not one", async () => {
    const response = await put(bodyOf(), { surveyId: "not-an-id" });

    expect(response.status).toBe(400);
    expect(mocks.updateSurveyContent).not.toHaveBeenCalled();
  });

  test("reads a body of exactly the import limit, and answers one byte more with a 413", async () => {
    const atLimit = await put(bodyOfSize(SURVEY_IMPORT_MAX_CREATE_BODY_BYTES));
    expect(atLimit.status).toBe(200);

    const overLimit = await put(bodyOfSize(SURVEY_IMPORT_MAX_CREATE_BODY_BYTES + 1));
    expect(overLimit.status).toBe(413);
    expect(mocks.updateSurveyContent).toHaveBeenCalledTimes(1);
  });
});

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AIOAuthTokenError } from "@formbricks/ai";
import {
  AuthorizationError,
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { RedactedAIError } from "@/lib/ai/loggable-error";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { GET as AVAILABILITY } from "./availability/route";
import { POST as TRANSLATE } from "./route";

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  can: vi.fn(),
  getSession: vi.fn(),
  resolveWorkspace: vi.fn(),
  getOrganizationIdFromSurveyId: vi.fn(),
  getOrganizationAIConfig: vi.fn(),
  assertOrganizationAIConfigured: vi.fn(),
  translateFields: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ assertCan: mocks.assertCan, can: mocks.can }));
vi.mock("@/app/api/v3/lib/workspace-context", () => ({ resolveV3WorkspaceContext: mocks.resolveWorkspace }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromSurveyId: mocks.getOrganizationIdFromSurveyId }));
vi.mock("@/lib/ai/service", () => ({
  AI_ERROR_CODES: {
    FEATURES_NOT_ENABLED: "ai_features_not_enabled",
    SMART_TOOLS_DISABLED: "ai_smart_tools_disabled",
    INSTANCE_NOT_CONFIGURED: "ai_instance_not_configured",
    QUOTA_EXCEEDED: "ai_quota_exceeded",
  },
  getOrganizationAIConfig: mocks.getOrganizationAIConfig,
  assertOrganizationAIConfigured: mocks.assertOrganizationAIConfigured,
  generateOrganizationAIObject: vi.fn(),
}));
vi.mock("@/modules/ee/ai-translation/lib/translate-fields", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/ai-translation/lib/translate-fields")>()),
  translateFields: mocks.translateFields,
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({ error: mocks.logError, warn: vi.fn(), info: vi.fn() })),
    error: vi.fn(),
  },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";
const OTHER_WORKSPACE_ID = "clwork2222222222222222222";
const ORG_ID = "clorg11111111111111111111";
const SURVEY_ID = "clsurv1111111111111111111";

const AI_CONFIG = {
  organizationId: ORG_ID,
  isAISmartToolsEntitled: true,
  isAISmartToolsEnabled: true,
  isInstanceConfigured: true,
};

const BODY = {
  fields: [
    { path: "blocks.0.elements.0.headline", defaultText: "How are you?", isRichText: false },
    { path: "blocks.0.elements.0.subheader", defaultText: "<p>Be honest</p>", isRichText: true },
  ],
  sourceLanguage: "English",
  targetLanguage: "German",
};

type TRequestOptions = { headers?: Record<string, string> };

const noProps = { params: Promise.resolve({}) } as never;

const availability = (surveyId = SURVEY_ID) =>
  AVAILABILITY(
    new NextRequest(`http://localhost/api/internal/ai-translations/availability?surveyId=${surveyId}`, {
      method: "GET",
      headers: SAME_ORIGIN_HEADERS,
    }),
    noProps
  );

const translate = (body: unknown = BODY, workspaceId = WORKSPACE_ID, { headers }: TRequestOptions = {}) =>
  TRANSLATE(
    new NextRequest(`http://localhost/api/internal/ai-translations?workspaceId=${workspaceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...SAME_ORIGIN_HEADERS, ...headers },
      body: JSON.stringify(body),
    }),
    noProps
  );

const actor = { type: "user", id: USER_ID };
const problem = async (response: Response) => (await response.json()) as { code?: string; detail?: string };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.assertCan.mockResolvedValue(undefined);
  mocks.can.mockResolvedValue(true);
  mocks.resolveWorkspace.mockImplementation(async (workspaceId: string) => ({
    workspaceId,
    organizationId: ORG_ID,
  }));
  mocks.getOrganizationIdFromSurveyId.mockResolvedValue(ORG_ID);
  mocks.getOrganizationAIConfig.mockResolvedValue(AI_CONFIG);
  mocks.assertOrganizationAIConfigured.mockResolvedValue(AI_CONFIG);
  mocks.translateFields.mockResolvedValue({
    "blocks.0.elements.0.headline": "Wie geht es dir?",
    "blocks.0.elements.0.subheader": "<p>Sei ehrlich</p>",
  });
  mocks.applyRateLimit.mockResolvedValue(undefined);
});

describe("GET /api/internal/ai-translations/availability", () => {
  test("asks for survey.read on the survey, as the server action did, and answers available", async () => {
    const response = await availability();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ available: true });
    expect(mocks.can).toHaveBeenCalledWith(actor, "survey.read", { type: "survey", id: SURVEY_ID });
    expect(mocks.getOrganizationAIConfig).toHaveBeenCalledWith(ORG_ID);
  });

  test("refuses a survey the caller can't read with 403, before reading anything about its organization", async () => {
    mocks.can.mockResolvedValue(false);

    expect((await availability()).status).toBe(403);
    expect(mocks.getOrganizationIdFromSurveyId).not.toHaveBeenCalled();
    expect(mocks.getOrganizationAIConfig).not.toHaveBeenCalled();
  });

  test("answers a survey deleted mid-request with 403, not 404", async () => {
    mocks.getOrganizationIdFromSurveyId.mockRejectedValue(new ResourceNotFoundError("survey", SURVEY_ID));
    expect((await availability()).status).toBe(403);
  });

  test.each([
    ["not in the plan", { isAISmartToolsEntitled: false, isAISmartToolsEnabled: false }, "not_in_plan"],
    ["switched off", { isAISmartToolsEnabled: false }, "not_enabled"],
    ["not configured on the instance", { isInstanceConfigured: false }, "instance_not_configured"],
  ])("answers unavailable with a reason when AI is %s", async (_label, overrides, reason) => {
    mocks.getOrganizationAIConfig.mockResolvedValue({ ...AI_CONFIG, ...overrides });

    const response = await availability();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ available: false, reason });
  });

  test("answers 400 for a malformed survey id", async () => {
    expect((await availability("not a cuid")).status).toBe(400);
    expect(mocks.can).not.toHaveBeenCalled();
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await availability()).status).toBe(401);
  });
});

describe("POST /api/internal/ai-translations", () => {
  test("asks for workspace.write, checks AI after it, and returns the translations", async () => {
    const response = await translate();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      translations: {
        "blocks.0.elements.0.headline": "Wie geht es dir?",
        "blocks.0.elements.0.subheader": "<p>Sei ehrlich</p>",
      },
    });
    expect(mocks.assertCan).toHaveBeenCalledWith(actor, "workspace.write", {
      type: "workspace",
      id: WORKSPACE_ID,
    });
    expect(mocks.assertOrganizationAIConfigured).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.translateFields).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
      ...BODY,
    });
  });

  test("records no audit event: nothing is saved", async () => {
    await translate();
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test("refuses a caller without workspace.write with 403, before any AI check or call", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));

    expect((await translate()).status).toBe(403);
    expect(mocks.assertOrganizationAIConfigured).not.toHaveBeenCalled();
    expect(mocks.translateFields).not.toHaveBeenCalled();
  });

  test("refuses another tenant's workspace with the same 403 as a workspace that doesn't exist", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));
    const otherTenant = await translate(BODY, OTHER_WORKSPACE_ID);
    mocks.resolveWorkspace.mockRejectedValue(new ResourceNotFoundError("workspace", OTHER_WORKSPACE_ID));
    const missing = await translate(BODY, OTHER_WORKSPACE_ID);

    expect(otherTenant.status).toBe(403);
    expect(missing.status).toBe(403);
    const { requestId: _a, ...otherBody } = await otherTenant.json();
    const { requestId: _b, ...missingBody } = await missing.json();
    expect(otherBody).toEqual(missingBody);
    expect(mocks.translateFields).not.toHaveBeenCalled();
  });

  test.each([
    ["not in the plan", "ai_features_not_enabled", 403],
    ["switched off for the organization", "ai_smart_tools_disabled", 403],
    ["not configured on the instance", "ai_instance_not_configured", 503],
  ])("answers AI %s with its code", async (_label, code, status) => {
    mocks.assertOrganizationAIConfigured.mockRejectedValue(new OperationNotAllowedError(code));

    const response = await translate();

    expect(response.status).toBe(status);
    expect((await problem(response)).code).toBe(code);
    expect(mocks.translateFields).not.toHaveBeenCalled();
  });

  test("answers a provider quota with 429 and its Retry-After", async () => {
    mocks.translateFields.mockRejectedValue(new TooManyRequestsError("ai_quota_exceeded", 20));

    const response = await translate();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("20");
  });

  test("answers the wrapper's request budget with 429 before any AI call", async () => {
    mocks.applyRateLimit.mockRejectedValue(new TooManyRequestsError("Rate limit exceeded", 30));

    expect((await translate()).status).toBe(429);
    expect(mocks.translateFields).not.toHaveBeenCalled();
  });

  test("charges the AI translation budget, not the default request budget", async () => {
    await translate();

    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      rateLimitConfigs.api.internalAiTranslate,
      expect.any(String)
    );
  });

  test("answers a batch too large for one answer with 422 ai_output_too_long", async () => {
    mocks.translateFields.mockRejectedValue(new InvalidInputError("ai_output_too_long"));

    const response = await translate();

    expect(response.status).toBe(422);
    expect((await problem(response)).code).toBe("ai_output_too_long");
  });

  test("answers rejected provider credentials with 502 ai_provider_auth_failed", async () => {
    mocks.translateFields.mockRejectedValue(
      new AIOAuthTokenError("token_request_failed", { statusCode: 401, tokenUrlHost: "idp.example.com" })
    );

    const response = await translate();

    expect(response.status).toBe(502);
    expect((await problem(response)).code).toBe("ai_provider_auth_failed");
  });

  test("answers any other provider failure with 502, relaying and logging none of its text", async () => {
    mocks.translateFields.mockRejectedValue(new RedactedAIError(new Error("Wie geht es dir? secret prompt")));

    const response = await translate();
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(text).not.toContain("secret prompt");
    expect(JSON.stringify(mocks.logError.mock.calls)).not.toContain("secret prompt");
  });

  test("answers an unexpected failure with a 500 that relays nothing", async () => {
    mocks.translateFields.mockRejectedValue(new Error("connection to db-7.internal lost"));

    const response = await translate();

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("db-7.internal");
  });

  test.each([
    ["no fields", { ...BODY, fields: [] }],
    ["an empty source language", { ...BODY, sourceLanguage: "" }],
    ["an over-long target language", { ...BODY, targetLanguage: "x".repeat(256) }],
    ["a field without its rich-text flag", { ...BODY, fields: [{ path: "a", defaultText: "b" }] }],
    ["an unknown field key", { ...BODY, fields: [{ ...BODY.fields[0], extra: true }] }],
    ["an unknown body key", { ...BODY, surveyId: SURVEY_ID }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await translate(body)).status).toBe(400);
    expect(mocks.translateFields).not.toHaveBeenCalled();
  });

  test("answers 400 for a malformed workspace id", async () => {
    expect((await translate(BODY, "not a cuid")).status).toBe(400);
  });

  test("refuses a cross-site request (CSRF)", async () => {
    const response = await translate(BODY, WORKSPACE_ID, { headers: { "sec-fetch-site": "cross-site" } });

    expect(response.status).toBe(403);
    expect(mocks.translateFields).not.toHaveBeenCalled();
  });
});

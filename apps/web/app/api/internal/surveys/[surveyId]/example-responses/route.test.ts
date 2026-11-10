import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  queueAuditEvent: vi.fn(),
  applyRateLimit: vi.fn(),
  getSurvey: vi.fn(),
  getOrganizationIdFromSurveyId: vi.fn(),
  getWorkspaceIdFromSurveyId: vi.fn(),
  assertOrganizationAIConfigured: vi.fn(),
  getResponseCountBySurveyId: vi.fn(),
  generateExampleResponseDataset: vi.fn(),
  persistExampleResponseDataset: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/survey/service", () => ({ getSurvey: mocks.getSurvey }));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromSurveyId: mocks.getOrganizationIdFromSurveyId,
  getWorkspaceIdFromSurveyId: mocks.getWorkspaceIdFromSurveyId,
}));
vi.mock("@/lib/ai/service", () => ({ assertOrganizationAIConfigured: mocks.assertOrganizationAIConfigured }));
vi.mock("@/lib/response/service", () => ({ getResponseCountBySurveyId: mocks.getResponseCountBySurveyId }));
vi.mock(
  "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/example-responses",
  () => ({ generateExampleResponseDataset: mocks.generateExampleResponseDataset })
);
vi.mock(
  "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/example-responses-persistence",
  () => ({ persistExampleResponseDataset: mocks.persistExampleResponseDataset })
);
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({
    action,
    targetType,
    status: "failure",
  })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const ORG_ID = "clorg11111111111111111111";
const SURVEY_ID = "clsurvey11111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";
const survey = { id: SURVEY_ID, workspaceId: WORKSPACE_ID, archivedAt: null };
const dataset = {
  responses: [{ data: {} }, { data: {} }],
  displays: [],
  tagName: "AI-generated example response",
};

const generate = () =>
  POST(
    new NextRequest(`http://localhost/api/internal/surveys/${SURVEY_ID}/example-responses`, {
      method: "POST",
      headers: SAME_ORIGIN_HEADERS,
    }),
    { params: Promise.resolve({ surveyId: SURVEY_ID }) } as never
  );

const operationLimits = () =>
  mocks.applyRateLimit.mock.calls
    .filter(([config]) => config.namespace !== rateLimitConfigs.api.v3.namespace)
    .map(([config, identifier]) => [config.namespace, identifier]);

const refusedWith = async (status: number, detail: string) => {
  const response = await generate();
  expect(response.status).toBe(status);
  expect((await response.json()).detail).toBe(detail);
  expect(mocks.generateExampleResponseDataset).not.toHaveBeenCalled();
  expect(mocks.persistExampleResponseDataset).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getOrganizationIdFromSurveyId.mockResolvedValue(ORG_ID);
  mocks.getWorkspaceIdFromSurveyId.mockResolvedValue(WORKSPACE_ID);
  mocks.assertOrganizationAIConfigured.mockResolvedValue({});
  mocks.getSurvey.mockResolvedValue(survey);
  mocks.getResponseCountBySurveyId.mockResolvedValue(0);
  mocks.generateExampleResponseDataset.mockResolvedValue(dataset);
  mocks.persistExampleResponseDataset.mockResolvedValue({ createdCount: 2 });
});

describe("POST /api/internal/surveys/{surveyId}/example-responses", () => {
  test("writes example responses into an empty survey for an editor, and audits the count", async () => {
    const response = await generate();

    expect(response.status).toBe(201);
    expect((await response.json()).data).toEqual({ surveyId: SURVEY_ID, createdCount: 2 });
    expect(operationLimits()).toEqual([
      [rateLimitConfigs.actions.generateExampleResponses.namespace, USER_ID],
    ]);
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "survey.write", {
      type: "survey",
      id: SURVEY_ID,
    });
    expect(mocks.assertOrganizationAIConfigured).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.generateExampleResponseDataset).toHaveBeenCalledWith({
      survey,
      organizationId: ORG_ID,
      workspaceId: WORKSPACE_ID,
      userId: USER_ID,
    });
    expect(mocks.persistExampleResponseDataset).toHaveBeenCalledWith({
      surveyId: SURVEY_ID,
      workspaceId: WORKSPACE_ID,
      dataset,
    });
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "survey",
        status: "success",
        organizationId: ORG_ID,
        targetId: SURVEY_ID,
        oldObject: null,
        newObject: { createdCount: 2 },
      })
    );
  });

  test("answers 429 with the limiter's message before anything else, and audits the refusal", async () => {
    mocks.applyRateLimit.mockImplementation(async (config: { namespace: string }) => {
      if (config.namespace === rateLimitConfigs.actions.generateExampleResponses.namespace) {
        throw new TooManyRequestsError("Maximum number of requests reached. Please try again later.", 60);
      }
    });

    await refusedWith(429, "Maximum number of requests reached. Please try again later.");
    expect(mocks.can).not.toHaveBeenCalled();
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "updated", status: "failure" })
    );
  });

  test("answers the uniform 403 to a caller who can't edit the survey", async () => {
    mocks.can.mockResolvedValue(false);
    await refusedWith(403, "You are not authorized to access this resource");
    expect(mocks.assertOrganizationAIConfigured).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for a survey that doesn't exist", async () => {
    mocks.getOrganizationIdFromSurveyId.mockRejectedValue(new ResourceNotFoundError("Survey", SURVEY_ID));
    await refusedWith(403, "You are not authorized to access this resource");
  });

  test("answers 403 with the AI gate's error code, attributed to the organization and survey", async () => {
    mocks.assertOrganizationAIConfigured.mockRejectedValue(
      new OperationNotAllowedError("ai_smart_tools_disabled")
    );

    await refusedWith(403, "ai_smart_tools_disabled");
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failure", organizationId: ORG_ID, targetId: SURVEY_ID })
    );
  });

  test("refuses an archived survey with the reason", async () => {
    mocks.getSurvey.mockResolvedValue({ ...survey, archivedAt: new Date("2026-11-01T00:00:00.000Z") });
    await refusedWith(403, "Cannot generate example responses for an archived survey.");
  });

  test("refuses a survey that already has responses, with the reason", async () => {
    mocks.getResponseCountBySurveyId.mockResolvedValue(1);
    await refusedWith(403, "Example responses can only be generated for a survey that has no responses yet.");
  });

  test("answers 422 with the reason when no question can be answered, writing nothing", async () => {
    mocks.generateExampleResponseDataset.mockResolvedValue({ ...dataset, responses: [] });

    const response = await generate();

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe(
      "This survey doesn't contain any question types we can synthesize answers for yet."
    );
    expect(mocks.persistExampleResponseDataset).not.toHaveBeenCalled();
  });
});

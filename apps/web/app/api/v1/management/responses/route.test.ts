import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TResponse } from "@formbricks/types/responses";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { resolveBodyIds } from "@/app/api/v1/management/lib/workspace-resolver";
import { sendToPipeline } from "@/app/lib/pipelines";
import { can } from "@/lib/authorization";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import { getSurvey } from "@/lib/survey/service";
import { createResponseWithQuotaEvaluation, getResponses } from "./lib/response";
import { GET, POST } from "./route";

/**
 * `withV1ApiWrapper` is reduced to its handler: authentication, rate limiting and audit logging are
 * orthogonal to the survey-visibility boundary this file proves for API keys (ENG-3282). The real
 * `canApiKeyReachSurveyResource` runs, over a stubbed readiness marker and `can`.
 */
vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper: ({ handler }: { handler: unknown }) => handler,
}));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: vi.fn() }));
vi.mock("@/lib/survey/service", () => ({ getSurvey: vi.fn() }));
vi.mock("@/app/api/v1/management/lib/workspace-resolver", () => ({ resolveBodyIds: vi.fn() }));
vi.mock("@/app/lib/pipelines", () => ({ sendToPipeline: vi.fn() }));
vi.mock("@/lib/workspace/service", () => ({ getWorkspaceLegacyStoragePrefixes: vi.fn(async () => []) }));
vi.mock("@/modules/storage/utils", () => ({
  resolveStorageUrlsInObject: vi.fn((value) => value),
  validateClientFileUploads: vi.fn(() => true),
}));
vi.mock("@/modules/api/lib/validation", () => ({
  formatValidationErrorsForV1Api: vi.fn(),
  validateResponseData: vi.fn(() => null),
}));
vi.mock("./lib/response", () => ({
  createResponseWithQuotaEvaluation: vi.fn(),
  getResponses: vi.fn(),
  getResponsesByWorkspaceIds: vi.fn(),
}));

const workspaceId = "clxworkspace00000000000001";
const surveyId = "clxsurvey0000000000000001";
const apiKey = { apiKeyId: "key_1", workspacePermissions: [], organizationId: "org_1" };
const survey = {
  id: surveyId,
  workspaceId,
  blocks: [],
  questions: [],
  isAnonymizeResponsesEnabled: false,
} as unknown as TSurvey;
const created = { id: "response_1", surveyId, finished: false } as unknown as TResponse;

type THandler = (args: object) => Promise<{ response: Response }>;

const post = () =>
  (POST as unknown as THandler)({
    req: new Request("http://localhost/api/v1/management/responses", {
      method: "POST",
      body: JSON.stringify({ surveyId, finished: false, data: {} }),
    }),
    authentication: apiKey,
  });

const get = () => {
  const url = `http://localhost/api/v1/management/responses?surveyId=${surveyId}`;
  return (GET as unknown as THandler)({
    req: Object.assign(new Request(url), { nextUrl: new URL(url) }),
    authentication: apiKey,
  });
};

/** A key with every workspace permission, whose survey-level answer is `surveyAllowed`. */
const actAsKey = (surveyAllowed: boolean) =>
  vi
    .mocked(can)
    .mockImplementation(async (_actor, _action, resource) =>
      resource.type === "survey" ? surveyAllowed : true
    );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isSurveyVisibilityReady).mockResolvedValue(true);
  vi.mocked(getSurvey).mockResolvedValue(survey);
  vi.mocked(getResponses).mockResolvedValue([]);
  vi.mocked(createResponseWithQuotaEvaluation).mockResolvedValue(created);
  vi.mocked(resolveBodyIds).mockImplementation(async (body) => ({
    ok: true,
    body: { ...body, workspaceId },
    alreadyAuthorized: false,
  }));
});

describe("POST /api/v1/management/responses survey visibility", () => {
  test("refuses a key with workspace write that cannot reach the survey, with GET's unauthorized body", async () => {
    actAsKey(false);

    const { response } = await post();
    const { response: getResponse } = await get();

    expect(response.status).toBe(getResponse.status);
    expect(await response.json()).toEqual(await getResponse.json());
    expect(createResponseWithQuotaEvaluation).not.toHaveBeenCalled();
    expect(sendToPipeline).not.toHaveBeenCalled();
    expect(can).toHaveBeenCalledWith({ type: "apiKey", id: "key_1" }, "survey.write", {
      type: "survey",
      id: surveyId,
    });
  });

  test("creates the response when the key can write the survey", async () => {
    actAsKey(true);

    const { response } = await post();

    expect(response.status).toBe(200);
    expect(createResponseWithQuotaEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({ surveyId, workspaceId })
    );
  });

  test("makes no survey-level check while visibility is not enforced", async () => {
    vi.mocked(isSurveyVisibilityReady).mockResolvedValue(false);
    actAsKey(false);

    const { response } = await post();

    expect(response.status).toBe(200);
    expect(can).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      type: "survey",
      id: surveyId,
    });
  });
});

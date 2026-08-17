import { beforeEach, describe, expect, test, vi } from "vitest";
import { type TResponseMeta } from "@formbricks/types/responses";
import { POST } from "./route";

/**
 * The v1 counterpart of the v2 ingest test. v1 is the endpoint older SDKs still post to, so the
 * "Anonymize responses" gate has to hold here identically — a survey that anonymizes must not start
 * capturing again just because the caller used the older URL.
 */

const WORKSPACE_ID = "cldx1a2b3c4d5e6f7g8h9i0j";
const SURVEY_ID = "clsx1a2b3c4d5e6f7g8h9i0j";
const CLIENT_IP = "203.0.113.7";
const SURVEY_URL = "https://example.com/survey?token=secret&utm_source=newsletter";

const {
  createResponseWithQuotaEvaluationMock,
  getSurveyMock,
  getClientIpFromHeadersMock,
  parseJsonBodyMock,
} = vi.hoisted(() => ({
  createResponseWithQuotaEvaluationMock: vi.fn(),
  getSurveyMock: vi.fn(),
  getClientIpFromHeadersMock: vi.fn(),
  parseJsonBodyMock: vi.fn(),
}));

// The wrapper only adds auth, rate limiting and audit logging around the handler, none of which this
// test is about. Unwrapping it keeps the test on the ingest behaviour.
vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper:
    ({ handler }: { handler: (params: unknown) => Promise<{ response: Response }> }) =>
    async (req: Request, props: unknown) =>
      (await handler({ req, props })).response,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "CF-IPCountry": "DE" }),
}));
vi.mock("./lib/response", () => ({
  createResponseWithQuotaEvaluation: createResponseWithQuotaEvaluationMock,
}));
vi.mock("@/lib/survey/service", () => ({ getSurvey: getSurveyMock }));
vi.mock("@/lib/utils/client-ip", () => ({ getClientIpFromHeaders: getClientIpFromHeadersMock }));
vi.mock("@/app/lib/api/request-body", () => ({
  parseJsonBodyWithLimit: parseJsonBodyMock,
  RequestBodyTooLargeError: class RequestBodyTooLargeError extends Error {},
}));
vi.mock("@/lib/utils/resolve-client-id", () => ({
  resolveClientApiIds: vi.fn(async () => ({ workspaceId: WORKSPACE_ID })),
}));
vi.mock("@/modules/survey/link/lib/pin-token", () => ({ verifyLinkSurveyPinToken: vi.fn(() => true) }));
vi.mock("@/modules/survey/link/lib/verify-email-gate", () => ({
  enforceVerifiedEmailGate: vi.fn(() => null),
}));
vi.mock("@/modules/api/lib/verify-response-recaptcha", () => ({
  verifyResponseRecaptcha: vi.fn(async () => null),
}));
vi.mock("@/app/api/client/[workspaceId]/responses/lib/single-use", () => ({
  validateSingleUseResponseInput: vi.fn(() => null),
}));
vi.mock("@/modules/storage/utils", () => ({ validateClientFileUploads: vi.fn(() => true) }));
vi.mock("@/modules/api/lib/validation", () => ({
  validateResponseData: vi.fn(() => null),
  formatValidationErrorsForV1Api: vi.fn(() => ({})),
}));
vi.mock("@/app/lib/pipelines", () => ({ sendToPipeline: vi.fn(async () => undefined) }));
vi.mock("@/modules/ee/quotas/lib/helpers", () => ({ createQuotaFullObject: vi.fn(() => ({})) }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromWorkspaceId: vi.fn(async () => "org-id") }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: vi.fn(async () => true) }));
vi.mock("@/app/lib/api/handle-api-error", () => ({
  handleApiError: vi.fn(() => new Response("error", { status: 500 })),
}));

const buildSurvey = (overrides: Record<string, unknown>) => ({
  id: SURVEY_ID,
  workspaceId: WORKSPACE_ID,
  status: "inProgress",
  pin: null,
  blocks: [],
  questions: [],
  isCaptureIpEnabled: false,
  isAnonymizeResponsesEnabled: false,
  ...overrides,
});

const buildRequest = () =>
  new Request("https://app.formbricks.com/api/v1/client/ws/responses", {
    method: "POST",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

/** Runs the route and returns the `meta` that reached the persistence call. */
const postAndCaptureMeta = async (survey: Record<string, unknown>): Promise<TResponseMeta> => {
  getSurveyMock.mockResolvedValue(survey);

  const response = await POST(buildRequest() as never, {
    params: Promise.resolve({ workspaceId: WORKSPACE_ID }),
  });

  expect(response.status).toBe(200);
  expect(createResponseWithQuotaEvaluationMock).toHaveBeenCalledTimes(1);

  return createResponseWithQuotaEvaluationMock.mock.calls[0][0].meta as TResponseMeta;
};

beforeEach(() => {
  vi.clearAllMocks();
  getClientIpFromHeadersMock.mockResolvedValue(CLIENT_IP);
  createResponseWithQuotaEvaluationMock.mockResolvedValue({
    id: "response-id",
    surveyId: SURVEY_ID,
    finished: false,
    quotaFull: null,
  });
  parseJsonBodyMock.mockResolvedValue({
    surveyId: SURVEY_ID,
    finished: false,
    data: {},
    meta: { source: "link", url: SURVEY_URL, action: "clicked-cta" },
  });
});

describe("POST /api/v1/client/[workspaceId]/responses — anonymize toggle OFF", () => {
  test("captures country and userAgent, and leaves the url query intact", async () => {
    const meta = await postAndCaptureMeta(buildSurvey({}));

    expect(meta.country).toBe("DE");
    expect(meta.userAgent).toEqual({ browser: "Chrome", device: "desktop", os: "macOS" });
    expect(meta.url).toBe(SURVEY_URL);
  });

  test("isCaptureIpEnabled false still means no ipAddress", async () => {
    const meta = await postAndCaptureMeta(buildSurvey({ isCaptureIpEnabled: false }));

    expect(meta.ipAddress).toBeUndefined();
  });

  test("isCaptureIpEnabled true still captures ipAddress", async () => {
    const meta = await postAndCaptureMeta(buildSurvey({ isCaptureIpEnabled: true }));

    expect(meta.ipAddress).toBe(CLIENT_IP);
  });
});

describe("POST /api/v1/client/[workspaceId]/responses — anonymize toggle ON", () => {
  test("suppresses ipAddress even when isCaptureIpEnabled is true, and never looks the IP up", async () => {
    const meta = await postAndCaptureMeta(
      buildSurvey({ isCaptureIpEnabled: true, isAnonymizeResponsesEnabled: true })
    );

    expect(meta).not.toHaveProperty("ipAddress");
    expect(getClientIpFromHeadersMock).not.toHaveBeenCalled();
  });

  test("drops country and the whole userAgent, strips the url query, keeps the `keep` fields", async () => {
    const meta = await postAndCaptureMeta(buildSurvey({ isAnonymizeResponsesEnabled: true }));

    expect(meta).not.toHaveProperty("country");
    expect(meta).not.toHaveProperty("userAgent");
    expect(meta.url).toBe("https://example.com/survey");
    expect(meta.source).toBe("link");
    expect(meta.action).toBe("clicked-cta");
  });
});

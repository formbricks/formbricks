import { beforeEach, describe, expect, test, vi } from "vitest";
import { type TResponseMeta } from "@formbricks/types/responses";
import { POST } from "./route";

/**
 * These tests exercise the "Anonymize responses" gate at the v2 ingest seam. Everything up to
 * `createResponseWithQuotaEvaluation` is stubbed; the assertion is on the `meta` that reaches it,
 * because that object is exactly what gets persisted.
 */

const WORKSPACE_ID = "cldx1a2b3c4d5e6f7g8h9i0j";
const SURVEY_ID = "clsx1a2b3c4d5e6f7g8h9i0j";
const CLIENT_IP = "203.0.113.7";

const {
  createResponseWithQuotaEvaluationMock,
  getSurveyMock,
  getClientIpFromHeadersMock,
  parseAndValidateJsonBodyMock,
} = vi.hoisted(() => ({
  createResponseWithQuotaEvaluationMock: vi.fn(),
  getSurveyMock: vi.fn(),
  getClientIpFromHeadersMock: vi.fn(),
  parseAndValidateJsonBodyMock: vi.fn(),
}));

vi.mock("./lib/response", () => ({
  createResponseWithQuotaEvaluation: createResponseWithQuotaEvaluationMock,
}));
vi.mock("@/lib/survey/service", () => ({ getSurvey: getSurveyMock }));
vi.mock("@/lib/utils/client-ip", () => ({ getClientIpFromHeaders: getClientIpFromHeadersMock }));
vi.mock("@/app/lib/api/parse-and-validate-json-body", () => ({
  parseAndValidateJsonBody: parseAndValidateJsonBodyMock,
}));
vi.mock("@/lib/utils/resolve-client-id", () => ({
  resolveClientApiIds: vi.fn(async () => ({ workspaceId: WORKSPACE_ID })),
}));
vi.mock("@/app/api/v2/client/[workspaceId]/responses/lib/utils", () => ({
  checkSurveyValidity: vi.fn(async () => null),
}));
vi.mock("@/modules/storage/utils", () => ({ validateClientFileUploads: vi.fn(() => true) }));
vi.mock("@/modules/api/v2/lib/element", () => ({
  validateOtherOptionLengthForMultipleChoice: vi.fn(() => undefined),
}));
vi.mock("@/modules/api/lib/validation", () => ({
  validateResponseData: vi.fn(() => null),
  formatValidationErrorsForV1Api: vi.fn(() => ({})),
}));
vi.mock("@/lib/survey/utils", () => ({ getElementsFromBlocks: vi.fn(() => []) }));
vi.mock("@/app/lib/pipelines", () => ({ sendToPipeline: vi.fn(async () => undefined) }));
vi.mock("@/modules/ee/quotas/lib/helpers", () => ({ createQuotaFullObject: vi.fn(() => ({})) }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromWorkspaceId: vi.fn(async () => "org-id") }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: vi.fn(async () => true) }));
vi.mock("@/app/lib/api/api-error-reporter", () => ({ reportApiError: vi.fn() }));

const buildSurvey = (overrides: Record<string, unknown>) => ({
  id: SURVEY_ID,
  workspaceId: WORKSPACE_ID,
  status: "inProgress",
  blocks: [],
  questions: [],
  isCaptureIpEnabled: false,
  isAnonymizeResponsesEnabled: false,
  ...overrides,
});

const buildRequest = () =>
  new Request("https://app.formbricks.com/api/v2/client/ws/responses", {
    method: "POST",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "CF-IPCountry": "DE",
    },
  });

/** Runs the route and returns the `meta` that reached the persistence call. */
const postAndCaptureMeta = async (survey: Record<string, unknown>): Promise<TResponseMeta> => {
  getSurveyMock.mockResolvedValue(survey);

  const response = await POST(buildRequest(), {
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
  parseAndValidateJsonBodyMock.mockResolvedValue({
    data: {
      workspaceId: WORKSPACE_ID,
      surveyId: SURVEY_ID,
      finished: false,
      data: {},
      meta: {
        source: "link",
        url: "https://example.com/survey?token=secret&utm_source=newsletter",
        action: "clicked-cta",
      },
    },
  });
});

describe("POST /api/v2/client/[workspaceId]/responses — anonymize toggle OFF", () => {
  test("captures country and userAgent, and leaves the url query intact", async () => {
    const meta = await postAndCaptureMeta(buildSurvey({}));

    expect(meta.country).toBe("DE");
    expect(meta.userAgent).toEqual({ browser: "Chrome", device: "desktop", os: "macOS" });
    expect(meta.url).toBe("https://example.com/survey?token=secret&utm_source=newsletter");
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

describe("POST /api/v2/client/[workspaceId]/responses — anonymize toggle ON", () => {
  test("suppresses ipAddress even when isCaptureIpEnabled is true, and never looks the IP up", async () => {
    const meta = await postAndCaptureMeta(
      buildSurvey({ isCaptureIpEnabled: true, isAnonymizeResponsesEnabled: true })
    );

    expect(meta).not.toHaveProperty("ipAddress");
    // Not merely stripped afterwards — the lookup is skipped entirely.
    expect(getClientIpFromHeadersMock).not.toHaveBeenCalled();
  });

  test("drops country and the whole userAgent, strips the url query, keeps the `keep` fields", async () => {
    const meta = await postAndCaptureMeta(buildSurvey({ isAnonymizeResponsesEnabled: true }));

    expect(meta).not.toHaveProperty("country");
    // The whole object, so browser/os/deviceType all go — the accepted cost of suppressing userAgent.
    expect(meta).not.toHaveProperty("userAgent");
    expect(meta.url).toBe("https://example.com/survey");
    expect(meta.source).toBe("link");
    expect(meta.action).toBe("clicked-cta");
  });

  // `utm*` are kept under Anonymize (campaign attribution, not respondent identity). They cannot be
  // asserted here yet: on this branch they only exist inside the `url` query string, which
  // `redactQuery` strips wholesale. ENG-1841 lifts them to their own top-level meta keys, where the
  // catalog classifies them `keep`; that behaviour is pinned in lib/response/anonymize.test.ts.
});

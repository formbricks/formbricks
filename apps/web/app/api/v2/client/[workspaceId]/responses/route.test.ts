import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "./route";

/**
 * The client ingest routes do not pass the caller's `meta` through — they rebuild it from a fixed
 * whitelist, and anything not re-listed there never reaches the database. These tests exist because
 * that is the single point where the whole ENG-1841 capture can be silently lost: the SDK can read
 * the runtime and the schema can accept it, and the field still disappears one line before the write.
 *
 * Everything below the route is mocked; what is asserted is the `meta` handed to the writer.
 */
const createResponseWithQuotaEvaluation = vi.fn();
const getSurvey = vi.fn();
const getClientIpFromHeaders = vi.fn();

vi.mock("./lib/response", () => ({
  createResponseWithQuotaEvaluation: (input: unknown) => createResponseWithQuotaEvaluation(input),
}));
vi.mock("@/lib/survey/service", () => ({ getSurvey: (id: string) => getSurvey(id) }));
vi.mock("@/lib/utils/client-ip", () => ({
  getClientIpFromHeaders: () => getClientIpFromHeaders(),
}));
vi.mock("@/lib/utils/resolve-client-id", () => ({
  resolveClientApiIds: (id: string) => Promise.resolve({ workspaceId: id }),
}));
vi.mock("@/app/lib/pipelines", () => ({ sendToPipeline: vi.fn() }));
vi.mock("@/app/lib/api/api-error-reporter", () => ({ reportApiError: vi.fn() }));
vi.mock("@/app/api/v2/client/[workspaceId]/responses/lib/utils", () => ({
  checkSurveyValidity: vi.fn(() => null),
}));
vi.mock("@/lib/survey/utils", () => ({ getElementsFromBlocks: vi.fn(() => []) }));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: vi.fn(() => "org-1"),
}));
vi.mock("@/modules/api/lib/validation", () => ({
  validateResponseData: vi.fn(() => null),
  formatValidationErrorsForV1Api: vi.fn(() => ({})),
}));
vi.mock("@/modules/api/v2/lib/element", () => ({
  validateOtherOptionLengthForMultipleChoice: vi.fn(() => null),
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: vi.fn(() => true) }));
vi.mock("@/modules/ee/quotas/lib/helpers", () => ({ createQuotaFullObject: vi.fn(() => ({})) }));
vi.mock("@/modules/storage/utils", () => ({ validateClientFileUploads: vi.fn(() => true) }));

const WORKSPACE_ID = "clx0000000000000000000w1";
const SURVEY_ID = "clx0000000000000000000s2";

/** The browser-runtime context an SDK actually sends, as one object. */
const autoCapturedMeta = {
  pageUrl: "https://shop.example.com/checkout?utm_source=news",
  pagePath: "/checkout",
  pageReferrer: "https://news.example.org/weekly",
  utmSource: "news",
  utmMedium: "email",
  utmCampaign: "august-launch",
  utmTerm: "checkout",
  utmContent: "hero-cta",
  screenWidth: 2560,
  screenHeight: 1440,
  viewportWidth: 1280,
  viewportHeight: 800,
  timezone: "Europe/Berlin",
};

const postResponse = async (meta: Record<string, unknown>, headers: Record<string, string> = {}) => {
  const request = new Request("https://app.formbricks.com/api/v2/client/ws/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      ...headers,
    },
    body: JSON.stringify({ surveyId: SURVEY_ID, finished: true, data: { q1: "yes" }, meta }),
  });

  const response = await POST(request, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });
  return { response, writtenMeta: createResponseWithQuotaEvaluation.mock.calls.at(0)?.[0]?.meta };
};

beforeEach(() => {
  vi.clearAllMocks();
  getSurvey.mockResolvedValue({
    id: SURVEY_ID,
    workspaceId: WORKSPACE_ID,
    status: "inProgress",
    isCaptureIpEnabled: false,
    blocks: [],
    questions: [],
  });
  createResponseWithQuotaEvaluation.mockResolvedValue({
    id: "clx0000000000000000000r3",
    surveyId: SURVEY_ID,
    finished: true,
    quotaFull: null,
  });
  getClientIpFromHeaders.mockResolvedValue("203.0.113.7");
});

describe("POST /api/v2/client/[workspaceId]/responses — auto-captured meta", () => {
  test("persists every auto-captured field the client sent", async () => {
    const { response, writtenMeta } = await postResponse(autoCapturedMeta);

    expect(response.status).toBe(200);
    expect(writtenMeta).toMatchObject(autoCapturedMeta);
  });

  test("drops keys that are not on the whitelist", async () => {
    // The endpoint is public. A caller inventing its own `meta` keys must not be able to write them.
    const { writtenMeta } = await postResponse({
      pagePath: "/checkout",
      sessionCookie: "s3cr3t",
      visitorType: "returning",
      timeOnPage: 42,
    });

    expect(writtenMeta).toHaveProperty("pagePath", "/checkout");
    expect(writtenMeta).not.toHaveProperty("sessionCookie");
    expect(writtenMeta).not.toHaveProperty("visitorType");
    expect(writtenMeta).not.toHaveProperty("timeOnPage");
  });

  test("keeps deriving userAgent and country server-side, ignoring what the client claimed", async () => {
    const { writtenMeta } = await postResponse(
      {
        ...autoCapturedMeta,
        userAgent: { browser: "NotAChance", os: "NotAnOs", device: "spoofed" },
        country: "XX",
      },
      { "CF-IPCountry": "DE" }
    );

    // Parsed from the `user-agent` header by UAParser, not taken from the body.
    expect(writtenMeta.userAgent).toStrictEqual({ browser: "Chrome", os: "macOS", device: "desktop" });
    expect(writtenMeta.country).toBe("DE");
  });

  test("does not let a client write an ipAddress when IP capture is off", async () => {
    const { writtenMeta } = await postResponse({ ...autoCapturedMeta, ipAddress: "198.51.100.9" });

    expect(writtenMeta.ipAddress).toBeUndefined();
    expect(getClientIpFromHeaders).not.toHaveBeenCalled();
  });

  test("captures the IP from the request when the survey enables it", async () => {
    getSurvey.mockResolvedValue({
      id: SURVEY_ID,
      workspaceId: WORKSPACE_ID,
      status: "inProgress",
      isCaptureIpEnabled: true,
      blocks: [],
      questions: [],
    });

    const { writtenMeta } = await postResponse({ ...autoCapturedMeta, ipAddress: "198.51.100.9" });

    expect(writtenMeta.ipAddress).toBe("203.0.113.7");
  });

  test("accepts a legacy client that sends only `{ source, url }`", async () => {
    // Older SDKs in the wild send nothing else, and must keep submitting successfully.
    const { response, writtenMeta } = await postResponse({
      source: "link",
      url: "https://app.formbricks.com/s/abc",
    });

    expect(response.status).toBe(200);
    expect(writtenMeta.source).toBe("link");
    expect(writtenMeta.url).toBe("https://app.formbricks.com/s/abc");
    expect(writtenMeta).not.toHaveProperty("pagePath");
  });
});

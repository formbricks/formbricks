import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The v1 twin of the v2 route test. Both endpoints rebuild `meta` from a whitelist, and the SDK
 * picks between them by whether the response carries a `userId` — so v1 is the path an **app**
 * survey takes (`api-client.ts`: `const fromV1 = !!responseInput.userId`), which is exactly the
 * surface ENG-1841 is about and the one the link-survey Playwright spec cannot reach.
 *
 * `withV1ApiWrapper` (rate limiting, auth, audit logging) is replaced by a passthrough: what is
 * under test is the handler's `meta` literal, not the wrapper it is registered through.
 */
vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper:
    ({ handler }: { handler: (args: unknown) => Promise<{ response: Response }> }) =>
    async (req: NextRequest, props: unknown) =>
      (await handler({ req, props })).response,
}));

const createResponseWithQuotaEvaluation = vi.fn();
const getSurvey = vi.fn();
const getClientIpFromHeaders = vi.fn();
let requestHeaders = new Headers();

vi.mock("next/headers", () => ({ headers: () => Promise.resolve(requestHeaders) }));
vi.mock("./lib/response", () => ({
  createResponseWithQuotaEvaluation: (input: unknown) => createResponseWithQuotaEvaluation(input),
}));
vi.mock("@/lib/survey/service", () => ({ getSurvey: (id: string) => getSurvey(id) }));
vi.mock("@/lib/utils/client-ip", () => ({ getClientIpFromHeaders: () => getClientIpFromHeaders() }));
vi.mock("@/lib/utils/resolve-client-id", () => ({
  resolveClientApiIds: (id: string) => Promise.resolve({ workspaceId: id }),
}));
vi.mock("@/app/lib/pipelines", () => ({ sendToPipeline: vi.fn() }));
vi.mock("@/app/api/client/[workspaceId]/responses/lib/single-use", () => ({
  validateSingleUseResponseInput: vi.fn(() => null),
}));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromWorkspaceId: vi.fn(() => "org-1") }));
vi.mock("@/modules/api/lib/validation", () => ({
  validateResponseData: vi.fn(() => null),
  formatValidationErrorsForV1Api: vi.fn(() => ({})),
}));
vi.mock("@/modules/api/lib/verify-response-recaptcha", () => ({
  verifyResponseRecaptcha: vi.fn(() => null),
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: vi.fn(() => true) }));
vi.mock("@/modules/ee/quotas/lib/helpers", () => ({ createQuotaFullObject: vi.fn(() => ({})) }));
vi.mock("@/modules/storage/utils", () => ({ validateClientFileUploads: vi.fn(() => true) }));
vi.mock("@/modules/survey/link/lib/pin-token", () => ({ verifyLinkSurveyPinToken: vi.fn(() => true) }));
vi.mock("@/modules/survey/link/lib/verify-email-gate", () => ({
  enforceVerifiedEmailGate: vi.fn(() => null),
}));

const { POST } = await import("./route");

const WORKSPACE_ID = "clx0000000000000000000w1";
const SURVEY_ID = "clx0000000000000000000s2";

const autoCapturedMeta = {
  pageUrl: "https://app.acme.com/settings/billing?utm_source=in-app",
  pagePath: "/settings/billing",
  pageReferrer: "https://app.acme.com/dashboard",
  utmSource: "in-app",
  utmMedium: "widget",
  utmCampaign: "nps-q3",
  utmTerm: "billing",
  utmContent: "sidebar",
  screenWidth: 1920,
  screenHeight: 1080,
  viewportWidth: 1512,
  viewportHeight: 945,
  timezone: "America/New_York",
};

const postResponse = async (meta: Record<string, unknown>) => {
  const request = new Request("https://app.formbricks.com/api/v1/client/ws/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    },
    // `userId` is what routes an app survey's response here rather than to v2.
    body: JSON.stringify({
      surveyId: SURVEY_ID,
      userId: "user-1",
      finished: true,
      data: { q1: "yes" },
      meta,
    }),
  });

  const response = await POST(request as NextRequest, {
    params: Promise.resolve({ workspaceId: WORKSPACE_ID }),
  });
  return { response, writtenMeta: createResponseWithQuotaEvaluation.mock.calls.at(0)?.[0]?.meta };
};

beforeEach(() => {
  vi.clearAllMocks();
  requestHeaders = new Headers({ "CF-IPCountry": "US" });
  getSurvey.mockResolvedValue({
    id: SURVEY_ID,
    workspaceId: WORKSPACE_ID,
    status: "inProgress",
    isCaptureIpEnabled: false,
    pin: null,
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

describe("POST /api/v1/client/[workspaceId]/responses — auto-captured meta", () => {
  test("persists every auto-captured field an app survey sent", async () => {
    const { writtenMeta } = await postResponse(autoCapturedMeta);

    expect(writtenMeta).toMatchObject(autoCapturedMeta);
  });

  test("drops keys that are not on the whitelist", async () => {
    const { writtenMeta } = await postResponse({
      pagePath: "/settings/billing",
      sessionCookie: "s3cr3t",
      pagesViewed: 7,
    });

    expect(writtenMeta).toHaveProperty("pagePath", "/settings/billing");
    expect(writtenMeta).not.toHaveProperty("sessionCookie");
    expect(writtenMeta).not.toHaveProperty("pagesViewed");
  });

  test("keeps deriving userAgent and country server-side", async () => {
    const { writtenMeta } = await postResponse({
      ...autoCapturedMeta,
      userAgent: { browser: "NotAChance", os: "NotAnOs", device: "spoofed" },
      country: "XX",
    });

    expect(writtenMeta.userAgent).toStrictEqual({ browser: "Mobile Safari", os: "iOS", device: "mobile" });
    expect(writtenMeta.country).toBe("US");
  });

  test("does not let a client write an ipAddress when IP capture is off", async () => {
    const { writtenMeta } = await postResponse({ ...autoCapturedMeta, ipAddress: "198.51.100.9" });

    expect(writtenMeta.ipAddress).toBeUndefined();
  });

  test("accepts a legacy client that sends only `{ source, url }`", async () => {
    const { writtenMeta } = await postResponse({ source: "app", url: "https://app.acme.com/dashboard" });

    expect(writtenMeta.source).toBe("app");
    expect(writtenMeta.url).toBe("https://app.acme.com/dashboard");
    expect(writtenMeta).not.toHaveProperty("pagePath");
  });
});

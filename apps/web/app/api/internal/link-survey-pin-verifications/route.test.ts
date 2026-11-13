import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { generateSurveySingleUseLinkParams } from "@/lib/utils/single-use-surveys";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { getResponseBySingleUseId, getSurveyWithMetadata } from "@/modules/survey/link/lib/data";
import { createLinkSurveyPinToken } from "@/modules/survey/link/lib/pin-token";
import { getLinkSurveyCustomCss } from "@/modules/survey/link/lib/respondent-custom-css";
import { recordSingleUseLinkValidation } from "@/modules/survey/link/lib/single-use-link-metrics";
import { getWorkspaceContextForLinkSurvey } from "@/modules/survey/link/lib/workspace";
import { POST } from "./route";

// The single-use gate runs for real, on real HMAC tokens and real AES-256-GCM ciphertexts: with a mocked
// resolver these tests would pass whether or not the route consulted it the way the page does. Both key
// sources are pinned to one value, which single-use-link.test.ts explains is load-bearing.
const { KEY } = vi.hoisted(() => ({ KEY: "0123456789abcdef".repeat(4) }));
vi.mock("@/lib/env", () => ({ env: { ENCRYPTION_KEY: KEY, SINGLE_USE_LEGACY_UNSIGNED_UNTIL: undefined } }));
vi.mock("@/lib/constants", async (importOriginal: () => Promise<typeof import("@/lib/constants")>) => ({
  ...(await importOriginal()),
  ENCRYPTION_KEY: KEY,
  WEBAPP_URL: "http://localhost:3000",
}));
vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock("@/modules/survey/link/lib/single-use-link-metrics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/survey/link/lib/single-use-link-metrics")>()),
  recordSingleUseLinkValidation: vi.fn(),
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyIPRateLimit: vi.fn(), applyRateLimit: vi.fn() }));
vi.mock("@/modules/survey/link/lib/data", () => ({
  getResponseBySingleUseId: vi.fn(),
  getSurveyWithMetadata: vi.fn(),
}));
vi.mock("@/modules/survey/link/lib/pin-token", () => ({ createLinkSurveyPinToken: vi.fn() }));
vi.mock("@/modules/survey/link/lib/workspace", () => ({ getWorkspaceContextForLinkSurvey: vi.fn() }));
vi.mock("@/modules/survey/link/lib/respondent-custom-css", () => ({
  getLinkSurveyCustomCss: vi.fn(),
  omitCustomCssSource: vi.fn((survey: Record<string, unknown>) => ({ ...survey, customCss: null })),
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: vi.fn() }));
vi.mock("server-only", () => ({}));

const surveyId = "clsurvey00000000000000000";

const mockSurvey = (overrides: Record<string, unknown> = {}) =>
  vi.mocked(getSurveyWithMetadata).mockResolvedValue({
    id: surveyId,
    type: "link",
    status: "inProgress",
    archivedAt: null,
    pin: null,
    isVerifyEmailEnabled: false,
    languages: [],
    workspaceId: "workspace-1",
    singleUse: null,
    customCss: { source: "body { color: red }" },
    questions: [{ headline: "private question" }],
    ...overrides,
  } as never);

type TLink = { suId?: string; suToken?: string };

const post = (body: unknown, headers: Record<string, string> = SAME_ORIGIN_HEADERS) =>
  POST(
    new NextRequest("http://localhost/api/internal/link-survey-pin-verifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    {} as never
  );

const validatePinWith = (pin: string, link: TLink = {}) => post({ surveyId, pin, ...link });
const validatePin = (pin = "1234") => validatePinWith(pin);

const singleUse = (isEncrypted = false) => ({ singleUse: { enabled: true, isEncrypted } });
const answeredWith = (finished: boolean) =>
  vi.mocked(getResponseBySingleUseId).mockReturnValue(async () => ({ id: "r1", finished }) as never);

const notOpen = [
  ["a draft survey", { status: "draft" }],
  ["an archived survey", { archivedAt: new Date("2026-10-01T00:00:00Z") }],
  ["an app survey", { type: "app" }],
  ["a paused survey", { status: "paused" }],
  ["a scheduled survey", { status: "paused", publishOn: new Date("2099-01-01T00:00:00Z") }],
  ["a completed survey", { status: "completed" }],
] as const;

const notInvited: [string, () => TLink][] = [
  ["no link", () => ({})],
  ["a suId with no token", () => ({ suId: "invitee-1" })],
  ["a forged token", () => ({ suId: "invitee-1", suToken: "0".repeat(64) })],
  [
    "a link minted for another survey",
    () => generateSurveySingleUseLinkParams("clother000000000000000000", false),
  ],
  [
    "another survey's encrypted link",
    () => generateSurveySingleUseLinkParams("clother000000000000000000", true),
  ],
];

// The PIN screen re-renders the page on exactly this answer, so pin it, and that nothing of the survey leaks.
const expectSurveyGone = async (response: Response) => {
  expect(response.status).toBe(404);
  const body = await response.json();
  expect(body).toMatchObject({ code: "not_found", details: { resource_type: "Survey" } });
  expect(JSON.stringify(body)).not.toContain("private question");
};

const expectInvalidPin = async (response: Response) => {
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({ detail: "INVALID_PIN", details: { reason: "INVALID_PIN" } });
};

const dataOf = async (response: Response) => {
  expect(response.status).toBe(200);
  return (await response.json()).data;
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true } as never);
  vi.mocked(getWorkspaceContextForLinkSurvey).mockResolvedValue({
    customCss: null,
    workspace: { styling: { allowStyleOverwrite: true } },
  } as never);
  vi.mocked(getLinkSurveyCustomCss).mockResolvedValue(undefined);
  vi.mocked(createLinkSurveyPinToken).mockReturnValue("pin-token");
  vi.mocked(getResponseBySingleUseId).mockReturnValue(async () => null);
  mockSurvey();
});

describe("POST /api/internal/link-survey-pin-verifications — rate limiting", () => {
  test("spends the client IP's budget, with its config, before loading the survey", async () => {
    await validatePin();

    expect(applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.validateSurveyPin);
    expect(applyIPRateLimit).toHaveBeenCalledBefore(vi.mocked(getSurveyWithMetadata));
  });

  test("keeps the action's limit: 10 a minute, failing closed", () => {
    expect(rateLimitConfigs.actions.validateSurveyPin).toEqual({
      interval: 60,
      allowedPerInterval: 10,
      namespace: "action:validate-survey-pin",
      failClosed: true,
    });
  });

  test("answers 429 and compares nothing when the budget is spent", async () => {
    mockSurvey({ pin: "1234" });
    vi.mocked(applyIPRateLimit).mockRejectedValue(
      new TooManyRequestsError("Maximum number of requests reached. Please try again later.", 60)
    );

    const response = await validatePin("1234");

    expect(response.status).toBe(429);
    expect(getSurveyWithMetadata).not.toHaveBeenCalled();
    expect(createLinkSurveyPinToken).not.toHaveBeenCalled();
  });

  test("audits nothing: the action wasn't audited", async () => {
    await validatePin();

    expect(queueAuditEvent).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/link-survey-pin-verifications", () => {
  test.each(notOpen)("%s is not found and its definition is not returned", async (_label, state) => {
    mockSurvey(state);

    await expectSurveyGone(await validatePin());
    expect(getWorkspaceContextForLinkSurvey).not.toHaveBeenCalled();
  });

  test("a PIN-protected draft is not found rather than answering whether the PIN is right", async () => {
    mockSurvey({ status: "draft", pin: "1234" });

    await expectSurveyGone(await validatePin("0000"));
    await expectSurveyGone(await validatePin("1234"));
    expect(createLinkSurveyPinToken).not.toHaveBeenCalled();
  });

  test("an in-progress survey still rejects a wrong PIN, before its CSS is resolved", async () => {
    mockSurvey({ pin: "1234" });

    await expectInvalidPin(await validatePin("0000"));
    expect(getWorkspaceContextForLinkSurvey).not.toHaveBeenCalled();
    expect(getLinkSurveyCustomCss).not.toHaveBeenCalled();
  });

  test("an in-progress survey with the right PIN is unlocked, with a PIN token", async () => {
    mockSurvey({ pin: "1234" });

    const data = await dataOf(await validatePin("1234"));

    expect(data).toMatchObject({ survey: { id: surveyId }, pinAuthToken: "pin-token" });
    expect(createLinkSurveyPinToken).toHaveBeenCalledWith(surveyId);
  });

  test("an unlocked survey comes back without its PIN or its stored CSS source, like the one the page renders", async () => {
    mockSurvey({ pin: "1234" });

    const data = await dataOf(await validatePin("1234"));

    expect(data.survey).toMatchObject({ id: surveyId, pin: null, customCss: null });
    expect(JSON.stringify(data)).not.toContain("color: red");
  });

  test("returns the compiled custom CSS once the PIN matched", async () => {
    mockSurvey({ pin: "1234" });
    vi.mocked(getLinkSurveyCustomCss).mockResolvedValue({ survey: { css: ".x{}" } } as never);

    const data = await dataOf(await validatePin("1234"));

    expect(data.customCss).toEqual({ survey: { css: ".x{}" } });
  });

  test("a survey without a PIN comes back without a PIN token", async () => {
    const data = await dataOf(await validatePin("0000"));

    expect(data).toMatchObject({ survey: { id: surveyId } });
    expect(data).not.toHaveProperty("pinAuthToken");
    expect(createLinkSurveyPinToken).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/link-survey-pin-verifications on a single-use survey (ENG-4041)", () => {
  test.each(notInvited)("with %s is not found and its definition is not returned", async (_label, link) => {
    mockSurvey(singleUse());

    await expectSurveyGone(await validatePinWith("0000", link()));
    expect(getWorkspaceContextForLinkSurvey).not.toHaveBeenCalled();
  });

  test("with a PIN but without its link is not found for any PIN, so the PIN can't be guessed", async () => {
    mockSurvey({ ...singleUse(), pin: "1234" });

    await expectSurveyGone(await validatePinWith("0000"));
    await expectSurveyGone(await validatePinWith("1234"));
    expect(createLinkSurveyPinToken).not.toHaveBeenCalled();
  });

  test.each([
    ["plaintext", false],
    ["encrypted", true],
  ])("with a valid %s link returns the definition", async (_label, isEncrypted) => {
    mockSurvey(singleUse(isEncrypted));

    const data = await dataOf(
      await validatePinWith("0000", generateSurveySingleUseLinkParams(surveyId, isEncrypted))
    );

    expect(data).toMatchObject({ survey: { id: surveyId } });
  });

  test.each([
    ["plaintext", false],
    ["encrypted", true],
  ])(
    "with a %s link that has already been answered is not found, like the page's 'already answered' screen",
    async (_label, isEncrypted) => {
      mockSurvey(singleUse(isEncrypted));
      const link = generateSurveySingleUseLinkParams(surveyId, isEncrypted);
      answeredWith(true);

      await expectSurveyGone(await validatePinWith("0000", link));
      // Looked up by the canonical id the response is stored under: the decrypted cuid for an encrypted
      // link, never the ciphertext in the URL.
      expect(getResponseBySingleUseId).toHaveBeenCalledWith(
        surveyId,
        isEncrypted ? expect.stringMatching(/^[a-z0-9]{24,}$/) : link.suId
      );
      expect(getWorkspaceContextForLinkSurvey).not.toHaveBeenCalled();
    }
  );

  test("with a link whose response is only partly answered still returns the definition, so it can resume", async () => {
    mockSurvey(singleUse());
    answeredWith(false);

    const data = await dataOf(
      await validatePinWith("0000", generateSurveySingleUseLinkParams(surveyId, false))
    );

    expect(data).toMatchObject({ survey: { id: surveyId } });
  });

  test("with a valid link still enforces its PIN", async () => {
    mockSurvey({ ...singleUse(), pin: "1234" });
    const link = generateSurveySingleUseLinkParams(surveyId, false);

    await expectInvalidPin(await validatePinWith("0000", link));
    expect(await dataOf(await validatePinWith("1234", link))).toMatchObject({ pinAuthToken: "pin-token" });
  });

  test("counts the check under its own surface", async () => {
    mockSurvey(singleUse());

    await expectSurveyGone(await validatePinWith("0000"));
    expect(recordSingleUseLinkValidation).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "rejected", reason: "missing_su_id", surface: "link_pin_action" })
    );
  });

  test.each([
    ["no single-use config", { singleUse: null }],
    ["single-use turned off", { singleUse: { enabled: false, isEncrypted: false } }],
  ])("a survey with %s ignores whatever link it is sent", async (_label, state) => {
    mockSurvey(state);

    const data = await dataOf(await validatePinWith("0000", { suId: "anything", suToken: "forged" }));

    expect(data).toMatchObject({ survey: { id: surveyId } });
    expect(recordSingleUseLinkValidation).not.toHaveBeenCalled();
    expect(getResponseBySingleUseId).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/link-survey-pin-verifications — input", () => {
  test("keeps the link it is sent", async () => {
    mockSurvey(singleUse());
    const link = generateSurveySingleUseLinkParams(surveyId, false);

    await dataOf(await validatePinWith("0000", link));

    expect(recordSingleUseLinkValidation).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "accepted", surface: "link_pin_action" })
    );
  });

  test.each([
    ["suId", { suId: "a".repeat(256) }],
    ["suToken", { suToken: "a".repeat(65) }],
  ])("refuses an over-long %s before loading anything", async (_label, link) => {
    expect((await validatePinWith("1234", link)).status).toBe(400);
    expect(getSurveyWithMetadata).not.toHaveBeenCalled();
  });

  test("accepts the longest link we mint", async () => {
    expect((await validatePinWith("1234", { suId: "a".repeat(255), suToken: "a".repeat(64) })).status).toBe(
      200
    );
  });

  test("refuses an over-long PIN and an unknown key", async () => {
    expect((await validatePin("1".repeat(65))).status).toBe(400);
    expect((await post({ surveyId, pin: "1234", contactId: "contact-1" })).status).toBe(400);
    expect(getSurveyWithMetadata).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request before spending anything", async () => {
    expect((await post({ surveyId, pin: "1234" }, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect(applyIPRateLimit).not.toHaveBeenCalled();
  });
});

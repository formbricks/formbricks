import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError, TooManyRequestsError } from "@formbricks/types/errors";
import { PRE_LOGIN_BODY_LIMIT_BYTES } from "@/app/api/internal/lib/limits";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { getOrganizationIdFromSurveyId } from "@/lib/utils/helper";
import { generateSurveySingleUseLinkParams } from "@/lib/utils/single-use-surveys";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { getOrganizationLogoUrl } from "@/modules/ee/whitelabel/email-customization/lib/organization";
import { sendLinkSurveyToVerifiedEmail } from "@/modules/email";
import {
  getResponseBySingleUseId,
  getSurveyOwnerId,
  getSurveyWithMetadata,
} from "@/modules/survey/link/lib/data";
import { recordSingleUseLinkValidation } from "@/modules/survey/link/lib/single-use-link-metrics";
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
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromSurveyId: vi.fn() }));
vi.mock("@/modules/ee/whitelabel/email-customization/lib/organization", () => ({
  getOrganizationLogoUrl: vi.fn(),
}));
vi.mock("@/modules/email", () => ({ sendLinkSurveyToVerifiedEmail: vi.fn() }));
vi.mock("@/modules/survey/link/lib/data", () => ({
  getResponseBySingleUseId: vi.fn(),
  getSurveyOwnerId: vi.fn(),
  getSurveyWithMetadata: vi.fn(),
}));
vi.mock("@/modules/email/lib/email-actor", () => ({
  resolveEmailActorUserId: vi.fn(async (ownerUserId: string | null) => ownerUserId ?? "org-owner"),
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: vi.fn() }));
vi.mock("server-only", () => ({}));

const surveyId = "clsurvey00000000000000000";

const mockSurvey = (overrides: Record<string, unknown> = {}) =>
  vi.mocked(getSurveyWithMetadata).mockResolvedValue({
    id: surveyId,
    name: "Stored survey name",
    type: "link",
    status: "inProgress",
    archivedAt: null,
    pin: null,
    isVerifyEmailEnabled: true,
    languages: [],
    workspaceId: "workspace-1",
    singleUse: null,
    ...overrides,
  } as never);

type TLink = { suId?: string; suToken?: string };

const emailInput = (link: TLink = {}) => ({
  surveyId,
  email: "respondent@example.com",
  locale: "en-US",
  ...link,
});

const post = (
  body: unknown,
  headers: Record<string, string> = SAME_ORIGIN_HEADERS,
  url = "http://localhost/api/internal/link-survey-verification-emails"
) =>
  POST(
    new NextRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    {} as never
  );

const sendEmailWith = (link: TLink) => post(emailInput(link));
// What the verify-email screen sends for a survey without single-use links.
const sendEmail = () => sendEmailWith({ suId: "" });

const singleUse = (isEncrypted = false) => ({ singleUse: { enabled: true, isEncrypted } });
const answeredWith = (finished: boolean) =>
  vi.mocked(getResponseBySingleUseId).mockReturnValue(async () => ({ id: "r1", finished }) as never);

// Every way a survey can exist without respondents being able to take it from its public link.
const notOpen = [
  ["a draft survey", { status: "draft" }],
  ["an archived survey", { archivedAt: new Date("2026-10-01T00:00:00Z") }],
  ["an app survey", { type: "app" }],
  ["a paused survey", { status: "paused" }],
  ["a scheduled survey", { status: "paused", publishOn: new Date("2099-01-01T00:00:00Z") }],
  ["a completed survey", { status: "completed" }],
] as const;

// Every way to reach a single-use survey without a link the page would accept.
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

// The verify-email screen re-renders the page on exactly this answer, so pin it, not just the status.
const expectSurveyGone = async (response: Response) => {
  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ code: "not_found", details: { resource_type: "Survey" } });
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(applyIPRateLimit).mockResolvedValue({ allowed: true } as never);
  vi.mocked(getOrganizationIdFromSurveyId).mockResolvedValue("org-1");
  vi.mocked(getSurveyOwnerId).mockResolvedValue("owner-1");
  vi.mocked(getOrganizationLogoUrl).mockResolvedValue(null);
  vi.mocked(getResponseBySingleUseId).mockReturnValue(async () => null);
  vi.mocked(sendLinkSurveyToVerifiedEmail).mockResolvedValue(true);
  mockSurvey();
});

describe("POST /api/internal/link-survey-verification-emails — rate limiting", () => {
  test("spends the client IP's budget, with its config, before loading the survey", async () => {
    await sendEmail();

    expect(applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.sendLinkSurveyEmail);
    expect(applyIPRateLimit).toHaveBeenCalledBefore(vi.mocked(getSurveyWithMetadata));
  });

  test("keeps the action's limit: 10 an hour, failing closed", () => {
    expect(rateLimitConfigs.actions.sendLinkSurveyEmail).toEqual({
      interval: 3600,
      allowedPerInterval: 10,
      namespace: "action:send-link-survey-email",
      failClosed: true,
    });
  });

  test("answers 429 with the limiter's message, and loads and sends nothing, when the budget is spent", async () => {
    vi.mocked(applyIPRateLimit).mockRejectedValue(
      new TooManyRequestsError("Maximum number of requests reached. Please try again later.", 60)
    );

    const response = await sendEmail();

    expect(response.status).toBe(429);
    expect((await response.json()).detail).toBe(
      "Maximum number of requests reached. Please try again later."
    );
    expect(getSurveyWithMetadata).not.toHaveBeenCalled();
    expect(sendLinkSurveyToVerifiedEmail).not.toHaveBeenCalled();
  });

  test("answers 429 with the cap's message when the email caps refuse the send (ENG-3823)", async () => {
    vi.mocked(sendLinkSurveyToVerifiedEmail).mockRejectedValue(
      new TooManyRequestsError("Too many emails to this address", 3600)
    );

    const response = await sendEmail();

    expect(response.status).toBe(429);
    expect((await response.json()).detail).toBe("Too many emails to this address");
  });

  test("audits nothing: the action wasn't audited", async () => {
    await sendEmail();

    expect(queueAuditEvent).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/link-survey-verification-emails — the open-survey gate", () => {
  test.each(notOpen)("%s is not found and no email is sent", async (_label, state) => {
    mockSurvey(state);

    await expectSurveyGone(await sendEmail());
    expect(sendLinkSurveyToVerifiedEmail).not.toHaveBeenCalled();
  });

  test("an unknown survey is not found the same way", async () => {
    vi.mocked(getSurveyWithMetadata).mockRejectedValue(new ResourceNotFoundError("Survey", surveyId));

    await expectSurveyGone(await sendEmail());
  });

  test("an in-progress survey without email verification answers EMAIL_VERIFICATION_NOT_ENABLED", async () => {
    mockSurvey({ isVerifyEmailEnabled: false });

    const response = await sendEmail();

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      detail: "EMAIL_VERIFICATION_NOT_ENABLED",
      details: { reason: "EMAIL_VERIFICATION_NOT_ENABLED" },
    });
    expect(sendLinkSurveyToVerifiedEmail).not.toHaveBeenCalled();
  });

  test("an in-progress survey with email verification sends the email", async () => {
    // `createdBy` is what an API caller may set; the owner is what the server set, and what counts.
    mockSurvey({ createdBy: "someone-else" });

    expect((await sendEmail()).status).toBe(204);
    expect(sendLinkSurveyToVerifiedEmail).toHaveBeenCalledTimes(1);
    // The visitor is anonymous, so the survey's organization and owner carry the limits (ENG-3823).
    expect(sendLinkSurveyToVerifiedEmail).toHaveBeenCalledWith(expect.anything(), {
      organizationId: "org-1",
      actorUserId: "owner-1",
      externalRecipient: true,
    });
  });

  // The page never shows the verify-email screen for a single-use survey without its link, so the route must
  // not confirm the survey exists, or mail anyone a link the page would refuse (ENG-4041).
  test.each(notInvited)(
    "a single-use survey with %s is not found and no email is sent",
    async (_label, link) => {
      mockSurvey(singleUse());

      await expectSurveyGone(await sendEmailWith(link()));
      expect(sendLinkSurveyToVerifiedEmail).not.toHaveBeenCalled();
    }
  );

  test("a single-use survey whose link has already been answered is not found and no email is sent", async () => {
    mockSurvey(singleUse());
    answeredWith(true);

    await expectSurveyGone(await sendEmailWith(generateSurveySingleUseLinkParams(surveyId, false)));
    expect(sendLinkSurveyToVerifiedEmail).not.toHaveBeenCalled();
  });

  test("a single-use survey with a valid link sends the email carrying that link", async () => {
    mockSurvey(singleUse());
    const link = generateSurveySingleUseLinkParams(surveyId, false);

    expect((await sendEmailWith(link)).status).toBe(204);
    expect(sendLinkSurveyToVerifiedEmail).toHaveBeenCalledWith(expect.objectContaining(link), {
      organizationId: "org-1",
      actorUserId: "owner-1",
      externalRecipient: true,
    });
    expect(recordSingleUseLinkValidation).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "accepted", surface: "link_email_action" })
    );
  });
});

describe("POST /api/internal/link-survey-verification-emails — the language", () => {
  const languages = [
    { default: true, enabled: true, language: { code: "en", alias: null } },
    { default: false, enabled: true, language: { code: "de-DE", alias: null } },
    { default: false, enabled: false, language: { code: "fr", alias: null } },
  ];

  test.each([
    ["an enabled language", "de-DE", "de-DE"],
    ["a disabled language", "fr", "default"],
    ["a language the survey doesn't have", "xx", "default"],
    ["no language", undefined, "default"],
  ])("resolves %s against the survey's own languages", async (_label, requested, expected) => {
    mockSurvey({ languages });

    await post({ ...emailInput({ suId: "" }), surveyLanguageCode: requested });

    expect(sendLinkSurveyToVerifiedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ surveyLanguageCode: expected }),
      expect.anything()
    );
  });
});

// ENG-4043: the route is public, so a caller must not choose what the email says, shows or reaches.
describe("POST /api/internal/link-survey-verification-emails — what a caller can put into the email", () => {
  const callerChosen = {
    surveyName: "Call +1 555 0100 about your refund",
    logoUrl: "https://attacker.example/logo.png",
  };

  test("refuses a survey name and logo in the body, and sends nothing", async () => {
    expect((await post({ ...emailInput(), ...callerChosen })).status).toBe(400);
    expect(sendLinkSurveyToVerifiedEmail).not.toHaveBeenCalled();
  });

  test.each([
    ["an address list", "a@example.com, b@example.com"],
    ["a named address", "Support <a@example.com>"],
  ])("refuses %s", async (_label, email) => {
    expect((await post({ ...emailInput(), email })).status).toBe(400);
    expect(sendLinkSurveyToVerifiedEmail).not.toHaveBeenCalled();
  });

  test("leaves a survey without single-use links out of the link's single-use values", async () => {
    await sendEmailWith({ suId: "Call +1 555 0100", suToken: "refund" });

    const [emailData] = vi.mocked(sendLinkSurveyToVerifiedEmail).mock.calls[0];
    expect(emailData).toMatchObject({ suId: undefined, suToken: undefined });
  });

  test("emails the stored survey name and the organization's logo", async () => {
    vi.mocked(getOrganizationLogoUrl).mockResolvedValueOnce("/storage/org-logo.png");

    await sendEmail();

    expect(sendLinkSurveyToVerifiedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ surveyName: "Stored survey name", logoUrl: "/storage/org-logo.png" }),
      expect.anything()
    );
  });
});

describe("POST /api/internal/link-survey-verification-emails — input limits", () => {
  // They reach a decrypt and a hash before the link is judged, so anything longer than a link we mint is
  // refused, and the longest one we mint is not.
  test.each([
    ["suId", { suId: "a".repeat(256) }],
    ["suToken", { suToken: "a".repeat(65) }],
  ])("refuses an over-long %s", async (_label, link) => {
    expect((await sendEmailWith(link)).status).toBe(400);
    expect(getSurveyWithMetadata).not.toHaveBeenCalled();
  });

  test("accepts the longest link we mint", async () => {
    expect((await sendEmailWith({ suId: "a".repeat(255), suToken: "a".repeat(64) })).status).not.toBe(400);
  });

  test("refuses an over-long survey language code", async () => {
    expect((await post({ ...emailInput(), surveyLanguageCode: "a".repeat(257) })).status).toBe(400);
  });

  test("refuses a body over the pre-login cap", async () => {
    const response = await post({
      ...emailInput(),
      surveyLanguageCode: "a".repeat(PRE_LOGIN_BODY_LIMIT_BYTES),
    });

    expect(response.status).toBe(413);
  });
});

describe("POST /api/internal/link-survey-verification-emails — cross-origin check", () => {
  test("refuses a cross-site request before spending anything", async () => {
    expect((await post(emailInput(), { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect(applyIPRateLimit).not.toHaveBeenCalled();
  });

  // The link-survey page is served on the survey domain (PUBLIC_URL), which the configured trusted origins
  // need not name: a same-origin fetch from it passes on the request's own host.
  test("lets a same-origin fetch from the survey domain through, by Sec-Fetch-Site or by Origin", async () => {
    const surveyDomainUrl = "https://surveys.example.com/api/internal/link-survey-verification-emails";

    expect((await post(emailInput({ suId: "" }), SAME_ORIGIN_HEADERS, surveyDomainUrl)).status).toBe(204);
    expect(
      (
        await post(
          emailInput({ suId: "" }),
          { host: "surveys.example.com", origin: "https://surveys.example.com" },
          surveyDomainUrl
        )
      ).status
    ).toBe(204);
    expect(
      (
        await post(
          emailInput({ suId: "" }),
          { host: "surveys.example.com", origin: "https://attacker.example" },
          surveyDomainUrl
        )
      ).status
    ).toBe(403);
  });
});

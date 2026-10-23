import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { actionClient } from "@/lib/utils/action-client";
import { generateSurveySingleUseLinkParams } from "@/lib/utils/single-use-surveys";
import { sendLinkSurveyToVerifiedEmail } from "@/modules/email";
import { sendLinkSurveyEmailAction, validateSurveyPinAction } from "./actions";
import { getResponseBySingleUseId, getSurveyWithMetadata } from "./lib/data";
import { createLinkSurveyPinToken } from "./lib/pin-token";
import { isLinkSurveyGoneError } from "./lib/public-access";
import { recordSingleUseLinkValidation } from "./lib/single-use-link-metrics";
import { getWorkspaceContextForLinkSurvey } from "./lib/workspace";

// The single-use gate runs for real, on real HMAC tokens and real AES-256-GCM ciphertexts: with a mocked
// resolver these tests would pass whether or not the action consulted it the way the page does. Both key
// sources are pinned to one value, which single-use-link.test.ts explains is load-bearing.
const { KEY } = vi.hoisted(() => ({ KEY: "0123456789abcdef".repeat(4) }));
vi.mock("@/lib/env", () => ({ env: { ENCRYPTION_KEY: KEY, SINGLE_USE_LEGACY_UNSIGNED_UNTIL: undefined } }));
vi.mock("@/lib/constants", async (importOriginal: () => Promise<typeof import("@/lib/constants")>) => ({
  ...(await importOriginal()),
  ENCRYPTION_KEY: KEY,
}));
vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("./lib/single-use-link-metrics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lib/single-use-link-metrics")>()),
  recordSingleUseLinkValidation: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  actionClient: {
    inputSchema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyIPRateLimit: vi.fn() }));
vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: { actions: { sendLinkSurveyEmail: {}, validateSurveyPin: {} } },
}));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromSurveyId: vi.fn().mockResolvedValue("org-1") }));
vi.mock("@/modules/ee/whitelabel/email-customization/lib/organization", () => ({
  getOrganizationLogoUrl: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/modules/email", () => ({ sendLinkSurveyToVerifiedEmail: vi.fn() }));
vi.mock("./lib/data", () => ({ getResponseBySingleUseId: vi.fn(), getSurveyWithMetadata: vi.fn() }));
vi.mock("./lib/pin-token", () => ({ createLinkSurveyPinToken: vi.fn() }));
vi.mock("./lib/workspace", () => ({ getWorkspaceContextForLinkSurvey: vi.fn() }));
vi.mock("./lib/respondent-custom-css", () => ({
  getLinkSurveyCustomCss: vi.fn().mockResolvedValue(undefined),
  omitCustomCssSource: vi.fn((survey: Record<string, unknown>) => {
    const { customCss: _customCss, ...rest } = survey;
    return rest;
  }),
}));

const surveyId = "clsurvey00000000000000000";

// Captured at import, before any `clearAllMocks`. The handler tests below bypass the schema, so without this
// a schema that dropped `suId` / `suToken` would strip them from every real call, and every valid single-use
// link would come back "not found" with all of those tests still green.
const [, [pinActionSchema]] = vi.mocked(actionClient.inputSchema).mock.calls as unknown as [
  unknown,
  [{ parse: (input: unknown) => unknown }],
];

const mockSurvey = (overrides: Record<string, unknown> = {}) =>
  vi.mocked(getSurveyWithMetadata).mockResolvedValue({
    id: surveyId,
    type: "link",
    status: "inProgress",
    archivedAt: null,
    pin: null,
    isVerifyEmailEnabled: true,
    languages: [],
    workspaceId: "workspace-1",
    questions: [{ headline: "private question" }],
    ...overrides,
  } as never);

const validatePin = (pin = "1234") => validateSurveyPinAction({ parsedInput: { surveyId, pin } } as never);
const sendEmailWith = (link: { suId?: string; suToken?: string }) =>
  sendLinkSurveyEmailAction({
    parsedInput: { surveyId, email: "respondent@example.com", surveyName: "s", ...link },
  } as never);
// What the verify-email screen sends for a survey without single-use links.
const sendEmail = () => sendEmailWith({ suId: "" });

// Every way a survey can exist without respondents being able to take it from its public link.
const notOpen = [
  ["a draft survey", { status: "draft" }],
  ["an archived survey", { archivedAt: new Date("2026-10-01T00:00:00Z") }],
  ["an app survey", { type: "app" }],
  ["a paused survey", { status: "paused" }],
  ["a scheduled survey", { status: "paused", publishOn: new Date("2099-01-01T00:00:00Z") }],
  ["a completed survey", { status: "completed" }],
] as const;

// The PIN and verify-email screens re-render the page only when the action's error matches what
// `isLinkSurveyGoneError` expects, so pin the exact error, not just its type.
const expectSurveyGone = async (call: Promise<unknown>) => {
  const error = await call.then(
    () => undefined,
    (thrown: unknown) => thrown
  );
  expect(error).toBeInstanceOf(ResourceNotFoundError);
  expect(isLinkSurveyGoneError((error as Error).message, surveyId)).toBe(true);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getWorkspaceContextForLinkSurvey).mockResolvedValue({
    customCss: null,
    workspace: { styling: { allowStyleOverwrite: true } },
  } as never);
  vi.mocked(createLinkSurveyPinToken).mockReturnValue("pin-token");
  vi.mocked(getResponseBySingleUseId).mockReturnValue(async () => null);
});

const answeredWith = (finished: boolean) =>
  vi.mocked(getResponseBySingleUseId).mockReturnValue(async () => ({ id: "r1", finished }) as never);

describe("validateSurveyPinAction", () => {
  test.each(notOpen)("%s is not found and its definition is not returned", async (_label, state) => {
    mockSurvey(state);

    await expectSurveyGone(validatePin());
    expect(getWorkspaceContextForLinkSurvey).not.toHaveBeenCalled();
  });

  test("a PIN-protected draft is not found rather than answering whether the PIN is right", async () => {
    mockSurvey({ status: "draft", pin: "1234" });

    await expectSurveyGone(validatePin("0000"));
    await expectSurveyGone(validatePin("1234"));
    expect(createLinkSurveyPinToken).not.toHaveBeenCalled();
  });

  test("an in-progress survey still rejects a wrong PIN", async () => {
    mockSurvey({ pin: "1234" });

    await expect(validatePin("0000")).rejects.toThrow("INVALID_PIN");
  });

  test("an in-progress survey with the right PIN is unlocked", async () => {
    mockSurvey({ pin: "1234" });

    const result = await validatePin("1234");

    expect(result).toMatchObject({ survey: { id: surveyId }, pinAuthToken: "pin-token" });
  });

  test("an unlocked survey comes back without its PIN, like the one the page renders", async () => {
    mockSurvey({ pin: "1234" });

    const result = await validatePin("1234");

    expect(result).toMatchObject({ survey: { id: surveyId, pin: null } });
  });
});

type TLink = { suId?: string; suToken?: string };

const singleUse = (isEncrypted = false) => ({ singleUse: { enabled: true, isEncrypted } });
const validatePinWith = (pin: string, link: TLink = {}) =>
  validateSurveyPinAction({ parsedInput: { surveyId, pin, ...link } } as never);

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

describe("validateSurveyPinAction on a single-use survey (ENG-4041)", () => {
  test("its input schema keeps the link it is sent", () => {
    expect(pinActionSchema.parse({ surveyId, pin: "1234", suId: "invitee-1", suToken: "token" })).toEqual({
      surveyId,
      pin: "1234",
      suId: "invitee-1",
      suToken: "token",
    });
  });

  test.each(notInvited)("with %s is not found and its definition is not returned", async (_label, link) => {
    mockSurvey(singleUse());

    await expectSurveyGone(validatePinWith("0000", link()));
    expect(getWorkspaceContextForLinkSurvey).not.toHaveBeenCalled();
  });

  test("with a PIN but without its link is not found for any PIN, so the PIN can't be guessed", async () => {
    mockSurvey({ ...singleUse(), pin: "1234" });

    await expectSurveyGone(validatePinWith("0000"));
    await expectSurveyGone(validatePinWith("1234"));
    expect(createLinkSurveyPinToken).not.toHaveBeenCalled();
  });

  test.each([
    ["plaintext", false],
    ["encrypted", true],
  ])("with a valid %s link returns the definition", async (_label, isEncrypted) => {
    mockSurvey(singleUse(isEncrypted));

    const result = await validatePinWith("0000", generateSurveySingleUseLinkParams(surveyId, isEncrypted));

    expect(result).toMatchObject({ survey: { id: surveyId } });
  });

  test("with a link that has already been answered is not found, like the page's 'already answered' screen", async () => {
    mockSurvey(singleUse());
    const link = generateSurveySingleUseLinkParams(surveyId, false);
    answeredWith(true);

    await expectSurveyGone(validatePinWith("0000", link));
    expect(getResponseBySingleUseId).toHaveBeenCalledWith(surveyId, link.suId);
    expect(getWorkspaceContextForLinkSurvey).not.toHaveBeenCalled();
  });

  test("with a link whose response is only partly answered still returns the definition, so it can resume", async () => {
    mockSurvey(singleUse());
    answeredWith(false);

    const result = await validatePinWith("0000", generateSurveySingleUseLinkParams(surveyId, false));

    expect(result).toMatchObject({ survey: { id: surveyId } });
  });

  test("with a valid link still enforces its PIN", async () => {
    mockSurvey({ ...singleUse(), pin: "1234" });
    const link = generateSurveySingleUseLinkParams(surveyId, false);

    await expect(validatePinWith("0000", link)).rejects.toThrow("INVALID_PIN");
    await expect(validatePinWith("1234", link)).resolves.toMatchObject({ pinAuthToken: "pin-token" });
  });

  test("counts the check under its own surface", async () => {
    mockSurvey(singleUse());

    await expectSurveyGone(validatePinWith("0000"));
    expect(recordSingleUseLinkValidation).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "rejected", reason: "missing_su_id", surface: "link_pin_action" })
    );
  });

  test.each([
    ["no single-use config", { singleUse: null }],
    ["single-use turned off", { singleUse: { enabled: false, isEncrypted: false } }],
  ])("a survey with %s ignores whatever link it is sent", async (_label, state) => {
    mockSurvey(state);

    const result = await validatePinWith("0000", { suId: "anything", suToken: "forged" });

    expect(result).toMatchObject({ survey: { id: surveyId } });
    expect(recordSingleUseLinkValidation).not.toHaveBeenCalled();
    expect(getResponseBySingleUseId).not.toHaveBeenCalled();
  });
});

describe("sendLinkSurveyEmailAction", () => {
  test.each(notOpen)("%s is not found and no email is sent", async (_label, state) => {
    mockSurvey(state);

    await expectSurveyGone(sendEmail());
    expect(sendLinkSurveyToVerifiedEmail).not.toHaveBeenCalled();
  });

  test("an in-progress survey with email verification sends the email", async () => {
    mockSurvey();

    await expect(sendEmail()).resolves.toEqual({ success: true });
    expect(sendLinkSurveyToVerifiedEmail).toHaveBeenCalledTimes(1);
  });

  // The page never shows the verify-email screen for a single-use survey without its link, so the action must
  // not confirm the survey exists, or mail anyone a link the page would refuse (ENG-4041).
  test.each(notInvited)(
    "a single-use survey with %s is not found and no email is sent",
    async (_label, link) => {
      mockSurvey(singleUse());

      await expectSurveyGone(sendEmailWith(link()));
      expect(sendLinkSurveyToVerifiedEmail).not.toHaveBeenCalled();
    }
  );

  test("a single-use survey whose link has already been answered is not found and no email is sent", async () => {
    mockSurvey(singleUse());
    answeredWith(true);

    await expectSurveyGone(sendEmailWith(generateSurveySingleUseLinkParams(surveyId, false)));
    expect(sendLinkSurveyToVerifiedEmail).not.toHaveBeenCalled();
  });

  test("a single-use survey with a valid link sends the email carrying that link", async () => {
    mockSurvey(singleUse());
    const link = generateSurveySingleUseLinkParams(surveyId, false);

    await expect(sendEmailWith(link)).resolves.toEqual({ success: true });
    expect(sendLinkSurveyToVerifiedEmail).toHaveBeenCalledWith(expect.objectContaining(link));
    expect(recordSingleUseLinkValidation).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "accepted", surface: "link_email_action" })
    );
  });
});

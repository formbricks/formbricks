import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { sendLinkSurveyToVerifiedEmail } from "@/modules/email";
import { sendLinkSurveyEmailAction, validateSurveyPinAction } from "./actions";
import { getSurveyWithMetadata } from "./lib/data";
import { createLinkSurveyPinToken } from "./lib/pin-token";
import { isLinkSurveyGoneError } from "./lib/public-access";
import { getWorkspaceContextForLinkSurvey } from "./lib/workspace";

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
vi.mock("./lib/data", () => ({ getSurveyWithMetadata: vi.fn() }));
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
const sendEmail = () =>
  sendLinkSurveyEmailAction({
    parsedInput: { surveyId, email: "respondent@example.com", surveyName: "s", suId: "" },
  } as never);

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
});

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
});

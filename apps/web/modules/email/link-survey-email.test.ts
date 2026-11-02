import { beforeEach, describe, expect, test, vi } from "vitest";
import { type TVerifiedLinkSurveyEmailData, sendLinkSurveyToVerifiedEmail } from "./index";

const mocks = vi.hoisted(() => ({ sendEmail: vi.fn(async () => true) }));

vi.mock("@/modules/email/lib/send-email", () => ({ sendEmail: mocks.sendEmail }));
const SURVEY_NAME_LABEL = "Survey name";

vi.mock("@/lingodotdev/server", () => ({
  getTranslate: async () => (key: string) =>
    key === "emails.verification_email_survey_name" ? SURVEY_NAME_LABEL : key,
}));
vi.mock("@/lib/jwt", () => ({ createTokenForLinkSurvey: () => "token" }));
vi.mock("@/lib/organization/service", () => ({ getOrganizationByWorkspaceId: vi.fn() }));

const rateLimit = { organizationId: "organization", actorUserId: "owner", externalRecipient: true };

const request: TVerifiedLinkSurveyEmailData = {
  surveyId: "clsurvey00000000000000000",
  email: "respondent@example.com",
  locale: "en-US",
  surveyName: "Customer Satisfaction",
};

const sentHtml = async (surveyName: string): Promise<string> => {
  await sendLinkSurveyToVerifiedEmail({ ...request, surveyName }, rateLimit);
  const [args] = mocks.sendEmail.mock.calls.at(-1) as unknown as [{ html: string }];
  return args.html;
};

// The survey name is the survey owner's free text in an email whose recipient a stranger chose (ENG-4043),
// so the rendered email bounds and de-links it rather than trusting the stored value.
describe("sendLinkSurveyToVerifiedEmail survey name", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("shows an ordinary survey name", async () => {
    const html = await sentHtml("Customer Satisfaction");

    expect(html).toContain(SURVEY_NAME_LABEL);
    expect(html).toContain("Customer Satisfaction");
  });

  test("strips links from the survey name and bounds its length", async () => {
    const html = await sentHtml(`Claim now https://spam.example/claim ${"x".repeat(500)}`);

    expect(html).toContain("Claim now");
    expect(html).not.toContain("spam.example");
    expect(html).not.toContain("x".repeat(60));
  });

  test("leaves the survey-name line out when nothing displayable is left", async () => {
    const html = await sentHtml("https://spam.example");

    expect(html).not.toContain(SURVEY_NAME_LABEL);
    expect(html).not.toContain("spam.example");
  });
});

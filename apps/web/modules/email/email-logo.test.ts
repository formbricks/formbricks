import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  sendEmailCustomizationPreviewEmail,
  sendEmbedSurveyPreviewEmail,
  sendLinkSurveyToVerifiedEmail,
} from "./index";

// Renders each sender's real email and reads the HTML handed to the transport, so a `hideLogo` that
// stops anywhere between the sender and the shared template shows up as a logo in the output.
const mocks = vi.hoisted(() => ({ sendEmail: vi.fn(async () => true) }));

vi.mock("@/modules/email/lib/send-email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lingodotdev/server", () => ({ getTranslate: async () => (key: string) => key }));
vi.mock("@/lib/jwt", () => ({ createTokenForLinkSurvey: () => "token" }));
vi.mock("@/lib/organization/service", () => ({ getOrganizationByWorkspaceId: vi.fn() }));

const sentHtml = (): string => {
  const [args] = mocks.sendEmail.mock.calls.at(-1) as unknown as [{ html: string }];
  return args.html;
};

const senders: [string, (logo: { logoUrl: string; hideLogo?: boolean }) => Promise<unknown>][] = [
  [
    "sendEmailCustomizationPreviewEmail",
    ({ logoUrl, hideLogo }) =>
      sendEmailCustomizationPreviewEmail("ada@example.com", "Ada", "en-US", "user", logoUrl, "org", hideLogo),
  ],
  [
    "sendEmbedSurveyPreviewEmail",
    (logo) =>
      sendEmbedSurveyPreviewEmail({
        to: "ada@example.com",
        innerHtml: "<p>Survey</p>",
        workspaceId: "workspace",
        locale: "en-US",
        actorUserId: "user",
        ...logo,
      }),
  ],
  [
    "sendLinkSurveyToVerifiedEmail",
    (logo) =>
      sendLinkSurveyToVerifiedEmail(
        {
          surveyId: "clsurvey00000000000000000",
          email: "respondent@example.com",
          locale: "en-US",
          surveyName: "Survey",
          ...logo,
        },
        { organizationId: "org", actorUserId: "owner", externalRecipient: true }
      ),
  ],
];

describe.each(senders)("%s logo (ENG-545)", (_name, send) => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Logo images are the only `<img>` the email chrome renders here, so their sources are the logo.
  const imageSources = (): string[] =>
    [...sentHtml().matchAll(/<img\b[^>]*\bsrc="([^"]*)"/g)].map(([, src]) => src);

  test("renders no logo when the organization removed it", async () => {
    await send({ logoUrl: "", hideLogo: true });

    expect(imageSources()).toEqual([]);
  });

  test("falls back to the Formbricks logo when none was ever set", async () => {
    await send({ logoUrl: "" });

    expect(imageSources()).toEqual([expect.stringContaining("logo-transparent.png")]);
  });

  test("renders the organization's own logo", async () => {
    await send({ logoUrl: "https://cdn.example.com/logo.png" });

    expect(imageSources()).toEqual(["https://cdn.example.com/logo.png"]);
  });
});

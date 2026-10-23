import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TResponse } from "@formbricks/types/responses";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { applyEmailRateLimits } from "@/modules/email/lib/email-rate-limits";
import { sendFollowUpEmail } from "@/modules/survey/follow-ups/lib/email";
import {
  sendDeleteAccountConfirmationEmail,
  sendEmailCustomizationPreviewEmail,
  sendEmbedSurveyPreviewEmail,
  sendInviteAcceptedEmail,
  sendInviteMemberEmail,
  sendLinkSurveyToVerifiedEmail,
  sendMemberRetentionNoticeEmail,
  sendPasswordResetLinkEmail,
  sendPasswordResetNotifyEmail,
  sendResponseFinishedEmail,
  sendSsoRecoveryFactorsRemovedEmail,
  sendSsoSignInHintEmail,
  sendSurveyRetentionNoticeEmail,
  sendVerificationEmail,
  sendVerificationLinkEmail,
  sendVerificationNewEmail,
} from "./index";

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/modules/email/lib/send-email", () => ({ sendEmail }));
// The real limits module, with the limiter off: it still checks each sender passed the context its type
// needs, without touching Redis.
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  RATE_LIMITING_DISABLED: true,
}));
vi.mock("@/lingodotdev/server", () => ({ getTranslate: async () => (key: string) => key }));
vi.mock("@/lib/jwt", () => ({
  createToken: () => "token",
  createEmailToken: () => "token",
  createEmailChangeToken: () => "token",
  createInviteToken: () => "token",
  createTokenForLinkSurvey: () => "token",
}));
vi.mock("@/lib/organization/service", () => ({ getOrganizationByWorkspaceId: async () => ({ id: "org" }) }));
vi.mock("@/lib/responses", () => ({ getElementResponseMapping: () => [] }));
vi.mock("@/modules/email/lib/survey-response-email", () => ({
  buildSurveyResponseEmailHtml: async () => "<p>Body</p>",
}));
vi.mock("@formbricks/email", () => ({
  renderAccountDeletionEmail: async () => "html",
  renderEmailCustomizationPreviewEmail: async () => "html",
  renderEmbedSurveyPreviewEmail: async () => "html",
  renderForgotPasswordEmail: async () => "html",
  renderInviteAcceptedEmail: vi.fn(async () => "html"),
  renderInviteEmail: async () => "html",
  renderLinkSurveyEmail: async () => "html",
  renderNewEmailVerification: async () => "html",
  renderPasswordResetNotifyEmail: async () => "html",
  renderResponseFinishedEmail: async () => "html",
  renderSsoRecoveryFactorsRemovedEmail: async () => "html",
  renderSsoSignInHintEmail: async () => "html",
  renderSurveyRetentionNoticeEmail: async () => "html",
  renderMemberRetentionNoticeEmail: async () => "html",
  renderVerificationEmail: async () => "html",
}));

const email = "recipient@example.com";
const locale = "en-US";
const link = "https://example.com/verify";
const survey = {
  id: "survey",
  name: "Survey",
  variables: [],
  hiddenFields: {},
  embeddedFields: [],
} as unknown as TSurvey;
const response = { id: "response", data: {} } as unknown as TResponse;

const senders: [string, () => Promise<unknown>][] = [
  ["invite", () => sendInviteMemberEmail("invite", email, "Inviter", "Invitee", "organization")],
  ["invite_accepted", () => sendInviteAcceptedEmail("Inviter", "Invitee", email, locale)],
  ["email_change_verification", () => sendVerificationNewEmail("user", email, locale)],
  ["email_verification", () => sendVerificationLinkEmail({ email, locale, verifyLink: link })],
  [
    "password_reset",
    () => sendPasswordResetLinkEmail({ email, locale, verifyLink: link, linkValidityInMinutes: 30 }),
  ],
  [
    "account_deletion",
    () => sendDeleteAccountConfirmationEmail({ email, locale, deleteLink: link, linkValidityInMinutes: 30 }),
  ],
  ["password_reset_notification", () => sendPasswordResetNotifyEmail({ email, locale })],
  [
    "sso_recovery_notification",
    () =>
      sendSsoRecoveryFactorsRemovedEmail({
        email,
        locale,
        passwordRemoved: true,
        twoFactorRemoved: false,
        apiKeysRemoved: false,
      }),
  ],
  ["sso_sign_in_hint", () => sendSsoSignInHintEmail({ email, locale, providerNames: ["Microsoft"] })],
  [
    "data_retention_notice",
    () =>
      sendSurveyRetentionNoticeEmail({
        email,
        locale,
        organizationId: "organization",
        organizationName: "Acme",
        archivedSurveys: [],
        responseDeletions: [{ name: "Survey", url: link, count: "3", deleteDate: "Dec 7, 2026" }],
      }),
  ],
  [
    "data_retention_notice",
    () =>
      sendMemberRetentionNoticeEmail({
        email,
        locale,
        organizationName: "Acme",
        deactivateDate: "Dec 7, 2026",
      }),
  ],
  ["response_notification", () => sendResponseFinishedEmail(email, locale, "workspace", survey, response, 1)],
  ["survey_preview", () => sendEmbedSurveyPreviewEmail(email, "html", "workspace", locale, "user")],
  ["customization_preview", () => sendEmailCustomizationPreviewEmail(email, "User", locale, "user")],
  [
    "verified_survey_link",
    () =>
      sendLinkSurveyToVerifiedEmail(
        { email, locale, surveyId: "survey", surveyName: "Survey" },
        { organizationId: "organization", actorUserId: "creator" }
      ),
  ],
];

describe("email source attribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendEmail.mockResolvedValue(true);
  });

  test.each(senders)("classifies %s at the sending boundary", async (emailType, send) => {
    await send();
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ emailType, to: email }));
  });

  // A sender that drops its organization or actor would skip the limits that matter most (ENG-3823).
  test.each(senders)("passes the context %s's rate limits need", async (_emailType, send) => {
    await send();
    const [{ emailType, to, rateLimit }] = sendEmail.mock.calls[0];
    await expect(applyEmailRateLimits(emailType, to, rateLimit)).resolves.toBeUndefined();
  });

  test.each([
    ["invite", { organizationId: "organization" }],
    ["response_notification", { organizationId: "org" }],
    ["survey_preview", { actorUserId: "user" }],
    ["customization_preview", { actorUserId: "user" }],
    ["verified_survey_link", { organizationId: "organization", actorUserId: "creator" }],
  ] as const)("rate-limits %s by who it is sent for", async (emailType, rateLimit) => {
    const [, send] = senders.find(([type]) => type === emailType)!;
    await send();
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ emailType, rateLimit }));
  });

  test("shows only bounded, link-free names in the invite-accepted email", async () => {
    const { renderInviteAcceptedEmail } = await import("@formbricks/email");
    await sendInviteAcceptedEmail("Inviter https://spam.example", "Win at spam.example", email, locale);
    expect(renderInviteAcceptedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ inviterName: "Inviter", inviteeName: "Win at" })
    );
  });

  test.each([
    ["email_verification", "email_verification"],
    ["sso_recovery", "sso_recovery_verification"],
  ] as const)("distinguishes the %s verification purpose", async (purpose, emailType) => {
    await sendVerificationEmail({ id: "user", email, locale, purpose });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ emailType }));
  });

  test("classifies legacy survey follow-ups separately from workflow emails", async () => {
    await sendFollowUpEmail({
      followUp: { action: { properties: { subject: "Follow up", body: "Body" } } } as Parameters<
        typeof sendFollowUpEmail
      >[0]["followUp"],
      to: email,
      replyTo: [],
      survey,
      response,
      attachResponseData: false,
      rateLimit: { organizationId: "organization", actorUserId: null, recipientFromResponse: true },
    });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ emailType: "survey_follow_up" }));
  });
});

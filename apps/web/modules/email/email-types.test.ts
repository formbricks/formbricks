import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TResponse } from "@formbricks/types/responses";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { sendFollowUpEmail } from "@/modules/survey/follow-ups/lib/email";
import {
  sendDeleteAccountConfirmationEmail,
  sendEmailCustomizationPreviewEmail,
  sendEmbedSurveyPreviewEmail,
  sendInviteAcceptedEmail,
  sendInviteMemberEmail,
  sendLinkSurveyToVerifiedEmail,
  sendPasswordResetLinkEmail,
  sendPasswordResetNotifyEmail,
  sendResponseFinishedEmail,
  sendSsoRecoveryFactorsRemovedEmail,
  sendSsoSignInHintEmail,
  sendVerificationEmail,
  sendVerificationLinkEmail,
  sendVerificationNewEmail,
} from "./index";

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/modules/email/lib/send-email", () => ({ sendEmail }));
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
  renderInviteAcceptedEmail: async () => "html",
  renderInviteEmail: async () => "html",
  renderLinkSurveyEmail: async () => "html",
  renderNewEmailVerification: async () => "html",
  renderPasswordResetNotifyEmail: async () => "html",
  renderResponseFinishedEmail: async () => "html",
  renderSsoRecoveryFactorsRemovedEmail: async () => "html",
  renderSsoSignInHintEmail: async () => "html",
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
  ["invite", () => sendInviteMemberEmail("invite", email, "Inviter", "Invitee")],
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
  ["response_notification", () => sendResponseFinishedEmail(email, locale, "workspace", survey, response, 1)],
  ["survey_preview", () => sendEmbedSurveyPreviewEmail(email, "html", "workspace", locale)],
  ["customization_preview", () => sendEmailCustomizationPreviewEmail(email, "User", locale)],
  [
    "verified_survey_link",
    () => sendLinkSurveyToVerifiedEmail({ email, locale, surveyId: "survey", surveyName: "Survey" }),
  ],
];

describe("email source attribution", () => {
  beforeEach(() => {
    sendEmail.mockResolvedValue(true);
  });

  test.each(senders)("classifies %s at the sending boundary", async (emailType, send) => {
    await send();
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ emailType, to: email }));
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
    });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ emailType: "survey_follow_up" }));
  });
});

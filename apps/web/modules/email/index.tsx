import {
  type TRetentionNoticeArchivedSurvey,
  type TRetentionNoticeResponseDeletion,
  renderAccountDeletionEmail,
  renderForgotPasswordEmail,
  renderInviteAcceptedEmail,
  renderInviteEmail,
  renderLinkSurveyEmail,
  renderMemberRetentionNoticeEmail,
  renderNewEmailVerification,
  renderPasswordResetNotifyEmail,
  renderSsoRecoveryFactorsRemovedEmail,
  renderSsoSignInHintEmail,
  renderSurveyRetentionNoticeEmail,
  renderVerificationEmail,
} from "@formbricks/email";
import { TEmailTemplateLegalProps } from "@formbricks/email/src/types/email";
import { logger } from "@formbricks/logger";
import type { TLinkSurveyEmailData } from "@formbricks/types/email";
import { TUserEmail, TUserLocale } from "@formbricks/types/user";
import { IMPRINT_ADDRESS, IMPRINT_URL, PRIVACY_URL, TERMS_URL, WEBAPP_URL } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import {
  createEmailChangeToken,
  createEmailToken,
  createInviteToken,
  createToken,
  createTokenForLinkSurvey,
} from "@/lib/jwt";
import { getTranslate } from "@/lingodotdev/server";
import {
  TVerificationRequestPurpose,
  VERIFICATION_LINK_TTL_SECONDS,
  buildVerificationLinks,
} from "@/modules/auth/lib/verification-links";
import type { TEmailRateLimitContext } from "@/modules/email/lib/email-rate-limits";
import { toInviteDisplayName } from "@/modules/email/lib/invite-display-name";
import { sendEmail } from "@/modules/email/lib/send-email";
import { buildVerifiedLinkSurveyUrl } from "@/modules/email/lib/verified-link-survey-url";
import { resolveStorageUrl } from "@/modules/storage/utils";

export { IS_SMTP_CONFIGURED } from "@/lib/constants";
export { sendEmail } from "@/modules/email/lib/send-email";

const legalProps: TEmailTemplateLegalProps = {
  privacyUrl: PRIVACY_URL || undefined,
  termsUrl: TERMS_URL || undefined,
  imprintUrl: IMPRINT_URL || undefined,
  imprintAddress: IMPRINT_ADDRESS || undefined,
};

export const sendVerificationNewEmail = async (
  id: string,
  email: string,
  locale: TUserLocale
): Promise<boolean> => {
  try {
    const t = await getTranslate(locale);
    const token = await createEmailChangeToken(id, email);
    const verifyLink = `${WEBAPP_URL}/verify-email-change?token=${encodeURIComponent(token)}`;

    const html = await renderNewEmailVerification({ verifyLink, t, ...legalProps });

    return await sendEmail({
      emailType: "email_change_verification",
      to: email,
      subject: t("emails.verification_new_email_subject"),
      html,
    });
  } catch (error) {
    logger.error(error, "Error in sendVerificationNewEmail");
    throw error;
  }
};

export const sendVerificationEmail = async ({
  id,
  email,
  locale,
  callbackUrl,
  purpose = "email_verification",
  linkTtlSeconds = VERIFICATION_LINK_TTL_SECONDS,
}: {
  id: string;
  email: TUserEmail;
  locale: TUserLocale;
  callbackUrl?: string;
  purpose?: TVerificationRequestPurpose;
  /**
   * Overridden only by an SSO-recovery resend, which has to mint a link no longer-lived than the intent
   * it points at — see `getSsoRecoveryPairedTtlSeconds`. Everything else gets the full window.
   */
  linkTtlSeconds?: number;
}): Promise<boolean> => {
  try {
    const t = await getTranslate(locale);
    const token = createToken(id, {
      expiresIn: linkTtlSeconds,
      purpose,
    });
    const { verifyLink, verificationRequestLink } = buildVerificationLinks({
      token,
      webAppUrl: WEBAPP_URL,
      callbackUrl,
      purpose,
      verificationRequestToken: createEmailToken(email),
    });

    const html = await renderVerificationEmail({
      verificationRequestLink,
      verifyLink,
      t,
      ...legalProps,
    });

    return await sendEmail({
      emailType: purpose === "sso_recovery" ? "sso_recovery_verification" : "email_verification",
      to: email,
      subject: t("emails.verification_email_subject"),
      html,
    });
  } catch (error) {
    logger.error(error, "Error in sendVerificationEmail");
    throw error; // Re-throw the error to maintain the original behavior
  }
};

export const sendPasswordResetLinkEmail = async (user: {
  email: TUserEmail;
  locale: TUserLocale;
  verifyLink: string;
  linkValidityInMinutes: number;
}): Promise<boolean> => {
  const t = await getTranslate(user.locale);
  const html = await renderForgotPasswordEmail({
    verifyLink: user.verifyLink,
    linkValidityInMinutes: user.linkValidityInMinutes,
    t,
    ...legalProps,
  });
  return await sendEmail({
    emailType: "password_reset",
    to: user.email,
    subject: t("emails.forgot_password_email_subject"),
    html,
  });
};

export const sendDeleteAccountConfirmationEmail = async (data: {
  email: TUserEmail;
  locale: TUserLocale;
  deleteLink: string;
  linkValidityInMinutes: number;
}): Promise<boolean> => {
  const t = await getTranslate(data.locale);
  const html = await renderAccountDeletionEmail({
    deleteLink: data.deleteLink,
    linkValidityInMinutes: data.linkValidityInMinutes,
    t,
    ...legalProps,
  });
  return await sendEmail({
    emailType: "account_deletion",
    to: data.email,
    subject: t("emails.delete_account_email_subject"),
    html,
  });
};

export const sendVerificationLinkEmail = async (data: {
  email: TUserEmail;
  locale: TUserLocale;
  verifyLink: string;
}): Promise<boolean> => {
  const t = await getTranslate(data.locale);
  const html = await renderVerificationEmail({
    // Better Auth supplies a single verification link; the resend CTA reuses it. Wiring
    // verificationRequestLink to a dedicated Better Auth resend endpoint is a post-cutover
    // refinement tracked in the ENG-1054 runbook, not a blocker for this flow.
    verificationRequestLink: data.verifyLink,
    verifyLink: data.verifyLink,
    t,
    ...legalProps,
  });
  return await sendEmail({
    emailType: "email_verification",
    to: data.email,
    subject: t("emails.verification_email_subject"),
    html,
  });
};

export const sendPasswordResetNotifyEmail = async (user: {
  email: string;
  locale: TUserLocale;
}): Promise<boolean> => {
  const t = await getTranslate(user.locale);
  const html = await renderPasswordResetNotifyEmail({ t, ...legalProps });
  return await sendEmail({
    emailType: "password_reset_notification",
    to: user.email,
    subject: t("emails.password_reset_notify_email_subject"),
    html,
  });
};

/**
 * Tell a user that SSO recovery removed the local sign-in factors from their account (ENG-2633).
 *
 * Recovery strips the password and any second factor from an account whose address was never proven,
 * because marking it verified would otherwise leave an attacker who registered on someone else's
 * address holding a live credential. No signal separates that attacker from an owner who simply never
 * clicked a verification link, so the strip is unconditional and this mail is what keeps the
 * legitimate case from being a silent downgrade: it names what went and links to re-enrolment.
 */
export const sendSsoRecoveryFactorsRemovedEmail = async ({
  email,
  locale,
  passwordRemoved,
  twoFactorRemoved,
  apiKeysRemoved,
}: {
  email: string;
  locale: TUserLocale;
  passwordRemoved: boolean;
  twoFactorRemoved: boolean;
  /** Keys the account had created were deleted with the strip (ENG-2634). */
  apiKeysRemoved: boolean;
}): Promise<boolean> => {
  const t = await getTranslate(locale);
  const html = await renderSsoRecoveryFactorsRemovedEmail({
    passwordRemoved,
    twoFactorRemoved,
    apiKeysRemoved,
    // The account profile page is where both factors this mail can name are re-enrolled — the password
    // form and the 2FA card both live there. There is no separate /settings/security route.
    securitySettingsLink: `${WEBAPP_URL}/account`,
    t,
    ...legalProps,
  });
  return await sendEmail({
    emailType: "sso_recovery_notification",
    to: email,
    subject: t("emails.sso_recovery_factors_removed_email_subject"),
    html,
  });
};

/**
 * Tell a user who asked for a password reset that their account has no password and signs in with an
 * identity provider instead (ENG-3262). Goes only to the address on file, so naming the provider here
 * reveals nothing the forgot-password page does not — that page answers identically for every address.
 */
export const sendSsoSignInHintEmail = async ({
  email,
  locale,
  providerNames,
}: {
  email: string;
  locale: TUserLocale;
  providerNames: string[];
}): Promise<boolean> => {
  const t = await getTranslate(locale);
  const html = await renderSsoSignInHintEmail({
    providerNames,
    loginLink: `${WEBAPP_URL}/auth/login`,
    t,
    ...legalProps,
  });
  return await sendEmail({
    emailType: "sso_sign_in_hint",
    to: email,
    subject: t("emails.sso_sign_in_hint_email_subject"),
    html,
  });
};

/**
 * The data retention notice (ENG-3612): what the organisation's policies will act on, for one person.
 * Dates and counts arrive formatted for the reader (their locale, the organisation's time zone). Returns
 * false when SMTP isn't configured; throws when sending fails, so the caller leaves the notice unsent.
 */
export const sendSurveyRetentionNoticeEmail = async ({
  email,
  locale,
  organizationId,
  organizationName,
  archivedSurveys,
  responseDeletions,
}: {
  email: string;
  locale: TUserLocale;
  organizationId: string;
  organizationName: string;
  archivedSurveys: TRetentionNoticeArchivedSurvey[];
  responseDeletions: TRetentionNoticeResponseDeletion[];
}): Promise<boolean> => {
  const t = await getTranslate(locale);
  const html = await renderSurveyRetentionNoticeEmail({
    organizationName,
    archivedSurveys,
    responseDeletions,
    settingsLink: `${WEBAPP_URL}/organizations/${organizationId}`,
    t,
    ...legalProps,
  });
  return await sendEmail({
    emailType: "data_retention_notice",
    to: email,
    subject: t("emails.retention_notice_email_subject", { organizationName }),
    html,
  });
};

/**
 * The members policy's notice (ENG-3612), to the member themself, in their locale. Returns false when
 * SMTP isn't configured; throws when sending fails, so the caller leaves the notice unsent.
 */
export const sendMemberRetentionNoticeEmail = async ({
  email,
  locale,
  organizationName,
  deactivateDate,
}: {
  email: string;
  locale: TUserLocale;
  organizationName: string;
  deactivateDate: string;
}): Promise<boolean> => {
  const t = await getTranslate(locale);
  const html = await renderMemberRetentionNoticeEmail({
    organizationName,
    deactivateDate,
    loginLink: `${WEBAPP_URL}/auth/login`,
    t,
    ...legalProps,
  });
  return await sendEmail({
    emailType: "data_retention_notice",
    to: email,
    subject: t("emails.member_retention_notice_email_subject", { organizationName }),
    html,
  });
};

export const sendInviteMemberEmail = async (
  inviteId: string,
  email: string,
  inviterName: string,
  inviteeName: string,
  organizationId: string
): Promise<boolean> => {
  const token = createInviteToken(inviteId, email, {
    expiresIn: "7d",
  });
  const t = await getTranslate();

  const verifyLink = `${WEBAPP_URL}/invite?token=${encodeURIComponent(token)}`;

  const html = await renderInviteEmail({
    inviteeName: toInviteDisplayName(inviteeName, ""),
    inviterName: toInviteDisplayName(inviterName, t("common.anonymous")),
    verifyLink,
    t,
    ...legalProps,
  });
  return await sendEmail({
    emailType: "invite",
    to: email,
    subject: t("emails.invite_member_email_subject"),
    html,
    rateLimit: { organizationId },
  });
};

export const sendInviteAcceptedEmail = async (
  inviterName: string,
  inviteeName: string,
  email: string,
  inviterLocale?: TUserLocale
): Promise<void> => {
  const t = await getTranslate(inviterLocale);
  // Both names are profile text the invitee or inviter chose, shown in a Formbricks-branded email.
  const html = await renderInviteAcceptedEmail({
    inviteeName: toInviteDisplayName(inviteeName, t("common.anonymous")),
    inviterName: toInviteDisplayName(inviterName, ""),
    t,
    ...legalProps,
  });
  await sendEmail({
    emailType: "invite_accepted",
    to: email,
    subject: t("emails.invite_accepted_email_subject"),
    html,
  });
};

export const sendLinkSurveyToVerifiedEmail = async (
  data: TLinkSurveyEmailData,
  rateLimit: TEmailRateLimitContext
): Promise<boolean> => {
  const surveyId = data.surveyId;
  const email = data.email;
  const surveyName = data.surveyName;
  const singleUseId = data.suId;
  const singleUseToken = data.suToken;
  // Resolve relative storage URLs to absolute URLs for email rendering
  const logoUrl = data.logoUrl ? resolveStorageUrl(data.logoUrl) : "";
  const token = createTokenForLinkSurvey(surveyId, email);
  const t = await getTranslate(data.locale);
  const surveyLink = buildVerifiedLinkSurveyUrl({
    publicDomain: getPublicDomain(),
    surveyId,
    token,
    singleUseId,
    singleUseToken,
    surveyLanguageCode: data.surveyLanguageCode,
  });

  const html = await renderLinkSurveyEmail({ surveyName, surveyLink, logoUrl, t, ...legalProps });
  return await sendEmail({
    emailType: "verified_survey_link",
    to: data.email,
    subject: t("emails.verified_link_survey_email_subject"),
    html,
    rateLimit,
  });
};

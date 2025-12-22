import { createTransport } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import {
  renderEmailCustomizationPreviewEmail,
  renderEmbedSurveyPreviewEmail,
  renderForgotPasswordEmail,
  renderInviteAcceptedEmail,
  renderInviteEmail,
  renderLinkSurveyEmail,
  renderNewEmailVerification,
  renderPasswordResetNotifyEmail,
  renderResponseFinishedEmail,
  renderVerificationEmail,
} from "@formbricks/email";
import { TEmailTemplateLegalProps } from "@formbricks/email/src/types/email";
import { logger } from "@formbricks/logger";
import type { TLinkSurveyEmailData } from "@formbricks/types/email";
import { InvalidInputError } from "@formbricks/types/errors";
import type { TResponse } from "@formbricks/types/responses";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { TUserEmail, TUserLocale } from "@formbricks/types/user";
import {
  DEBUG,
  IMPRINT_ADDRESS,
  IMPRINT_URL,
  MAIL_FROM,
  MAIL_FROM_NAME,
  PRIVACY_URL,
  SMTP_AUTHENTICATED,
  SMTP_HOST,
  SMTP_PASSWORD,
  SMTP_PORT,
  SMTP_REJECT_UNAUTHORIZED_TLS,
  SMTP_SECURE_ENABLED,
  SMTP_USER,
  TERMS_URL,
  WEBAPP_URL,
} from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { createEmailChangeToken, createInviteToken, createToken, createTokenForLinkSurvey } from "@/lib/jwt";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getElementResponseMapping } from "@/lib/responses";
import { getTranslate } from "@/lingodotdev/server";

export const IS_SMTP_CONFIGURED = Boolean(SMTP_HOST && SMTP_PORT);

const legalProps: TEmailTemplateLegalProps = {
  privacyUrl: PRIVACY_URL || undefined,
  termsUrl: TERMS_URL || undefined,
  imprintUrl: IMPRINT_URL || undefined,
  imprintAddress: IMPRINT_ADDRESS || undefined,
};

interface SendEmailDataProps {
  to: string;
  replyTo?: string;
  subject: string;
  text?: string;
  html: string;
}

export const sendEmail = async (emailData: SendEmailDataProps): Promise<boolean> => {
  if (!IS_SMTP_CONFIGURED) {
    logger.info("SMTP is not configured, skipping email sending");
    return false;
  }
  try {
    const transporter = createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE_ENABLED, // true for 465, false for other ports
      ...(SMTP_AUTHENTICATED
        ? {
            auth: {
              type: "LOGIN",
              user: SMTP_USER,
              pass: SMTP_PASSWORD,
            },
          }
        : {}),
      tls: {
        rejectUnauthorized: SMTP_REJECT_UNAUTHORIZED_TLS,
      },
      logger: DEBUG,
      debug: DEBUG,
    } as SMTPTransport.Options);

    const emailDefaults = {
      from: `${MAIL_FROM_NAME ?? "Formbricks"} <${MAIL_FROM ?? "noreply@formbricks.com"}>`,
    };
    await transporter.sendMail({ ...emailDefaults, ...emailData });

    return true;
  } catch (error) {
    logger.error(error, "Error in sendEmail");
    throw new InvalidInputError("Incorrect SMTP credentials");
  }
};

export const sendVerificationNewEmail = async (id: string, email: string): Promise<boolean> => {
  try {
    const t = await getTranslate();
    const token = createEmailChangeToken(id, email);
    const verifyLink = `${WEBAPP_URL}/verify-email-change?token=${encodeURIComponent(token)}`;

    const html = await renderNewEmailVerification({ verifyLink, t, ...legalProps });

    return await sendEmail({
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
}: {
  id: string;
  email: TUserEmail;
}): Promise<boolean> => {
  try {
    const t = await getTranslate();
    const token = createToken(id, {
      expiresIn: "1d",
    });
    const verifyLink = `${WEBAPP_URL}/auth/verify?token=${encodeURIComponent(token)}`;
    const verificationRequestLink = `${WEBAPP_URL}/auth/verification-requested?token=${encodeURIComponent(token)}`;

    const html = await renderVerificationEmail({
      verificationRequestLink,
      verifyLink,
      t,
      ...legalProps,
    });

    return await sendEmail({
      to: email,
      subject: t("emails.verification_email_subject"),
      html,
    });
  } catch (error) {
    logger.error(error, "Error in sendVerificationEmail");
    throw error; // Re-throw the error to maintain the original behavior
  }
};

export const sendForgotPasswordEmail = async (user: {
  id: string;
  email: TUserEmail;
  locale: TUserLocale;
}): Promise<boolean> => {
  const t = await getTranslate();
  const token = createToken(user.id, {
    expiresIn: "1d",
  });
  const verifyLink = `${WEBAPP_URL}/auth/forgot-password/reset?token=${encodeURIComponent(token)}`;
  const html = await renderForgotPasswordEmail({ verifyLink, t, ...legalProps });
  return await sendEmail({
    to: user.email,
    subject: t("emails.forgot_password_email_subject"),
    html,
  });
};

export const sendPasswordResetNotifyEmail = async (user: { email: string }): Promise<boolean> => {
  const t = await getTranslate();
  const html = await renderPasswordResetNotifyEmail({ t, ...legalProps });
  return await sendEmail({
    to: user.email,
    subject: t("emails.password_reset_notify_email_subject"),
    html,
  });
};

export const sendInviteMemberEmail = async (
  inviteId: string,
  email: string,
  inviterName: string,
  inviteeName: string
): Promise<boolean> => {
  const token = createInviteToken(inviteId, email, {
    expiresIn: "7d",
  });
  const t = await getTranslate();

  const verifyLink = `${WEBAPP_URL}/invite?token=${encodeURIComponent(token)}`;

  const html = await renderInviteEmail({ inviteeName, inviterName, verifyLink, t, ...legalProps });
  return await sendEmail({
    to: email,
    subject: t("emails.invite_member_email_subject"),
    html,
  });
};

export const sendInviteAcceptedEmail = async (
  inviterName: string,
  inviteeName: string,
  email: string
): Promise<void> => {
  const t = await getTranslate();
  const html = await renderInviteAcceptedEmail({ inviteeName, inviterName, t, ...legalProps });
  await sendEmail({
    to: email,
    subject: t("emails.invite_accepted_email_subject"),
    html,
  });
};

export const sendResponseFinishedEmail = async (
  email: string,
  environmentId: string,
  survey: TSurvey,
  response: TResponse,
  responseCount: number
): Promise<void> => {
  const t = await getTranslate();
  const personEmail = response.contactAttributes?.email;
  const organization = await getOrganizationByEnvironmentId(environmentId);

  if (!organization) {
    throw new Error("Organization not found");
  }

  // Pre-process the element response mapping before passing to email
  const elements = getElementResponseMapping(survey, response);

  const html = await renderResponseFinishedEmail({
    survey,
    responseCount,
    response,
    WEBAPP_URL,
    environmentId,
    organization,
    elements,
    t,
    ...legalProps,
  });

  await sendEmail({
    to: email,
    subject: personEmail
      ? t("emails.response_finished_email_subject_with_email", {
          personEmail,
          surveyName: survey.name,
        })
      : t("emails.response_finished_email_subject", {
          surveyName: survey.name,
        }),
    replyTo: personEmail?.toString() ?? MAIL_FROM,
    html,
  });
};

export const sendEmbedSurveyPreviewEmail = async (
  to: string,
  innerHtml: string,
  environmentId: string,
  logoUrl?: string
): Promise<boolean> => {
  const t = await getTranslate();
  const html = await renderEmbedSurveyPreviewEmail({
    html: innerHtml,
    environmentId,
    logoUrl,
    t,
    ...legalProps,
  });
  return await sendEmail({
    to,
    subject: t("emails.embed_survey_preview_email_subject"),
    html,
  });
};

export const sendEmailCustomizationPreviewEmail = async (
  to: string,
  userName: string,
  logoUrl?: string
): Promise<boolean> => {
  const t = await getTranslate();
  const emailHtmlBody = await renderEmailCustomizationPreviewEmail({
    userName,
    logoUrl,
    t,
    ...legalProps,
  });

  return await sendEmail({
    to,
    subject: t("emails.email_customization_preview_email_subject"),
    html: emailHtmlBody,
  });
};

export const sendLinkSurveyToVerifiedEmail = async (data: TLinkSurveyEmailData): Promise<boolean> => {
  const surveyId = data.surveyId;
  const email = data.email;
  const surveyName = data.surveyName;
  const singleUseId = data.suId;
  const logoUrl = data.logoUrl || "";
  const token = createTokenForLinkSurvey(surveyId, email);
  const t = await getTranslate();
  const getSurveyLink = (): string => {
    if (singleUseId) {
      return `${getPublicDomain()}/s/${surveyId}?verify=${encodeURIComponent(token)}&suId=${singleUseId}`;
    }
    return `${getPublicDomain()}/s/${surveyId}?verify=${encodeURIComponent(token)}`;
  };
  const surveyLink = getSurveyLink();

  const html = await renderLinkSurveyEmail({ surveyName, surveyLink, logoUrl, t, ...legalProps });
  return await sendEmail({
    to: data.email,
    subject: t("emails.verified_link_survey_email_subject"),
    html,
  });
};

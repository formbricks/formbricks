import { EmailCustomizationPreviewEmail } from "@/modules/email/emails/general/email-customization-preview-email";
import { render } from "@react-email/render";
import { createTransport } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import {
  DEBUG,
  MAIL_FROM,
  SMTP_AUTHENTICATED,
  SMTP_HOST,
  SMTP_PASSWORD,
  SMTP_PORT,
  SMTP_REJECT_UNAUTHORIZED_TLS,
  SMTP_SECURE_ENABLED,
  SMTP_USER,
  WEBAPP_URL,
} from "@formbricks/lib/constants";
import { createInviteToken, createToken, createTokenForLinkSurvey } from "@formbricks/lib/jwt";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import type { TLinkSurveyEmailData } from "@formbricks/types/email";
import { InvalidInputError } from "@formbricks/types/errors";
import type { TResponse } from "@formbricks/types/responses";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { TUserEmail, TUserLocale } from "@formbricks/types/user";
import type { TWeeklySummaryNotificationResponse } from "@formbricks/types/weekly-summary";
import { ForgotPasswordEmail } from "./emails/auth/forgot-password-email";
import { PasswordResetNotifyEmail } from "./emails/auth/password-reset-notify-email";
import { VerificationEmail } from "./emails/auth/verification-email";
import { InviteAcceptedEmail } from "./emails/invite/invite-accepted-email";
import { InviteEmail } from "./emails/invite/invite-email";
import { OnboardingInviteEmail } from "./emails/invite/onboarding-invite-email";
import { EmbedSurveyPreviewEmail } from "./emails/survey/embed-survey-preview-email";
import { FollowUpEmail } from "./emails/survey/follow-up";
import { LinkSurveyEmail } from "./emails/survey/link-survey-email";
import { ResponseFinishedEmail } from "./emails/survey/response-finished-email";
import { NoLiveSurveyNotificationEmail } from "./emails/weekly-summary/no-live-survey-notification-email";
import { WeeklySummaryNotificationEmail } from "./emails/weekly-summary/weekly-summary-notification-email";
import { translateEmailText } from "./lib/utils";

export const IS_SMTP_CONFIGURED = Boolean(SMTP_HOST && SMTP_PORT);

interface SendEmailDataProps {
  to: string;
  replyTo?: string;
  subject: string;
  text?: string;
  html: string;
}

const getEmailSubject = (projectName: string, locale: string): string => {
  return translateEmailText("weekly_summary_email_subject", locale, {
    projectName,
  });
};

export const sendEmail = async (emailData: SendEmailDataProps): Promise<boolean> => {
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
      from: `Formbricks <${MAIL_FROM ?? "noreply@formbricks.com"}>`,
    };
    await transporter.sendMail({ ...emailDefaults, ...emailData });

    return true;
  } catch (error) {
    throw new InvalidInputError("Incorrect SMTP credentials");
  }
};

export const sendVerificationEmail = async ({
  id,
  email,
  locale,
}: {
  id: string;
  email: TUserEmail;
  locale: TUserLocale;
}): Promise<boolean> => {
  const token = createToken(id, email, {
    expiresIn: "1d",
  });
  const verifyLink = `${WEBAPP_URL}/auth/verify?token=${encodeURIComponent(token)}`;
  const verificationRequestLink = `${WEBAPP_URL}/auth/verification-requested?token=${encodeURIComponent(token)}`;
  const html = await render(VerificationEmail({ verificationRequestLink, verifyLink, locale }));
  return await sendEmail({
    to: email,
    subject: translateEmailText("verification_email_subject", locale),
    html,
  });
};

export const sendForgotPasswordEmail = async (user: {
  id: string;
  email: TUserEmail;
  locale: TUserLocale;
}): Promise<boolean> => {
  const token = createToken(user.id, user.email, {
    expiresIn: "1d",
  });
  const verifyLink = `${WEBAPP_URL}/auth/forgot-password/reset?token=${encodeURIComponent(token)}`;
  const html = await render(ForgotPasswordEmail({ verifyLink, locale: user.locale }));
  return await sendEmail({
    to: user.email,
    subject: translateEmailText("forgot_password_email_subject", user.locale),
    html,
  });
};

export const sendPasswordResetNotifyEmail = async (user: {
  email: string;
  locale: TUserLocale;
}): Promise<boolean> => {
  const html = await render(PasswordResetNotifyEmail({ locale: user.locale }));
  return await sendEmail({
    to: user.email,
    subject: translateEmailText("password_reset_notify_email_subject", user.locale),
    html,
  });
};

export const sendInviteMemberEmail = async (
  inviteId: string,
  email: string,
  inviterName: string,
  inviteeName: string,
  isOnboardingInvite?: boolean,
  inviteMessage?: string,
  locale = "en-US"
): Promise<boolean> => {
  const token = createInviteToken(inviteId, email, {
    expiresIn: "7d",
  });

  const verifyLink = `${WEBAPP_URL}/invite?token=${encodeURIComponent(token)}`;

  if (isOnboardingInvite && inviteMessage) {
    const html = await render(
      OnboardingInviteEmail({ verifyLink, inviteMessage, inviterName, locale, inviteeName })
    );
    return await sendEmail({
      to: email,
      subject: translateEmailText("onboarding_invite_email_subject", locale, {
        inviterName,
      }),
      html,
    });
  } else {
    const html = await render(InviteEmail({ inviteeName, inviterName, verifyLink, locale }));
    return await sendEmail({
      to: email,
      subject: translateEmailText("invite_member_email_subject", locale),
      html,
    });
  }
};

export const sendInviteAcceptedEmail = async (
  inviterName: string,
  inviteeName: string,
  email: string,
  locale: string
): Promise<void> => {
  const html = await render(InviteAcceptedEmail({ inviteeName, inviterName, locale }));
  await sendEmail({
    to: email,
    subject: translateEmailText("invite_accepted_email_subject", locale),
    html,
  });
};

export const sendResponseFinishedEmail = async (
  email: string,
  environmentId: string,
  survey: TSurvey,
  response: TResponse,
  responseCount: number,
  locale: string
): Promise<void> => {
  const personEmail = response.contactAttributes?.email;
  const organization = await getOrganizationByEnvironmentId(environmentId);

  if (!organization) {
    throw new Error("Organization not found");
  }

  const html = await render(
    ResponseFinishedEmail({
      survey,
      responseCount,
      response,
      WEBAPP_URL,
      environmentId,
      organization,
      locale,
    })
  );

  await sendEmail({
    to: email,
    subject: personEmail
      ? translateEmailText("response_finished_email_subject_with_email", locale, {
          personEmail,
          surveyName: survey.name,
        })
      : translateEmailText("response_finished_email_subject", locale, {
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
  locale: string,
  logoUrl?: string
): Promise<boolean> => {
  const html = await render(EmbedSurveyPreviewEmail({ html: innerHtml, environmentId, locale, logoUrl }));
  return await sendEmail({
    to,
    subject: translateEmailText("embed_survey_preview_email_subject", locale),
    html,
  });
};

export const sendEmailCustomizationPreviewEmail = async (
  to: string,
  userName: string,
  locale: string,
  logoUrl?: string
): Promise<boolean> => {
  const emailHtmlBody = await render(EmailCustomizationPreviewEmail({ userName, locale, logoUrl }));

  return await sendEmail({
    to,
    subject: translateEmailText("email_customization_preview_email_subject", locale),
    html: emailHtmlBody,
  });
};

export const sendLinkSurveyToVerifiedEmail = async (data: TLinkSurveyEmailData): Promise<boolean> => {
  const surveyId = data.surveyId;
  const email = data.email;
  const surveyName = data.surveyName;
  const singleUseId = data.suId;
  const locale = data.locale;
  const logoUrl = data.logoUrl || "";
  const token = createTokenForLinkSurvey(surveyId, email);
  const getSurveyLink = (): string => {
    if (singleUseId) {
      return `${WEBAPP_URL}/s/${surveyId}?verify=${encodeURIComponent(token)}&suId=${singleUseId}`;
    }
    return `${WEBAPP_URL}/s/${surveyId}?verify=${encodeURIComponent(token)}`;
  };
  const surveyLink = getSurveyLink();

  const html = await render(LinkSurveyEmail({ surveyName, surveyLink, locale, logoUrl }));
  return await sendEmail({
    to: data.email,
    subject: translateEmailText("verified_link_survey_email_subject", locale),
    html,
  });
};

export const sendWeeklySummaryNotificationEmail = async (
  email: string,
  notificationData: TWeeklySummaryNotificationResponse,
  locale: string
): Promise<void> => {
  const startDate = `${notificationData.lastWeekDate.getDate().toString()} ${notificationData.lastWeekDate.toLocaleString(
    "default",
    { month: "short" }
  )}`;
  const endDate = `${notificationData.currentDate.getDate().toString()} ${notificationData.currentDate.toLocaleString(
    "default",
    { month: "short" }
  )}`;
  const startYear = notificationData.lastWeekDate.getFullYear();
  const endYear = notificationData.currentDate.getFullYear();
  const html = await render(
    WeeklySummaryNotificationEmail({
      notificationData,
      startDate,
      endDate,
      startYear,
      endYear,
      locale,
    })
  );
  await sendEmail({
    to: email,
    subject: getEmailSubject(notificationData.projectName, locale),
    html,
  });
};

export const sendNoLiveSurveyNotificationEmail = async (
  email: string,
  notificationData: TWeeklySummaryNotificationResponse,
  locale: string
): Promise<void> => {
  const startDate = `${notificationData.lastWeekDate.getDate().toString()} ${notificationData.lastWeekDate.toLocaleString(
    "default",
    { month: "short" }
  )}`;
  const endDate = `${notificationData.currentDate.getDate().toString()} ${notificationData.currentDate.toLocaleString(
    "default",
    { month: "short" }
  )}`;
  const startYear = notificationData.lastWeekDate.getFullYear();
  const endYear = notificationData.currentDate.getFullYear();
  const html = await render(
    NoLiveSurveyNotificationEmail({
      notificationData,
      startDate,
      endDate,
      startYear,
      endYear,
      locale,
    })
  );
  await sendEmail({
    to: email,
    subject: getEmailSubject(notificationData.projectName, locale),
    html,
  });
};

export const sendFollowUpEmail = async (
  html: string,
  subject: string,
  to: string,
  replyTo: string[],
  logoUrl?: string
): Promise<void> => {
  const emailHtmlBody = await render(
    FollowUpEmail({
      html,
      logoUrl,
    })
  );

  await sendEmail({
    to,
    replyTo: replyTo.join(", "),
    subject,
    html: emailHtmlBody,
  });
};

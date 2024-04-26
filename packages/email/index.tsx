import { render } from "@react-email/render";
import nodemailer from "nodemailer";

import {
  DEBUG,
  MAIL_FROM,
  SMTP_HOST,
  SMTP_PASSWORD,
  SMTP_PORT,
  SMTP_SECURE_ENABLED,
  SMTP_USER,
  WEBAPP_URL,
} from "@formbricks/lib/constants";
import { createInviteToken, createToken, createTokenForLinkSurvey } from "@formbricks/lib/jwt";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { TWeeklySummaryNotificationResponse } from "@formbricks/types/weeklySummary";

import { ForgotPasswordEmail } from "./components/auth/ForgotPasswordEmail";
import { PasswordResetNotifyEmail } from "./components/auth/PasswordResetNotifyEmail";
import { VerificationEmail } from "./components/auth/VerificationEmail";
import { EmailTemplate } from "./components/general/EmailTemplate";
import { InviteAcceptedEmail } from "./components/invite/InviteAcceptedEmail";
import { InviteEmail } from "./components/invite/InviteEmail";
import { OnboardingInviteEmail } from "./components/invite/OnboardingInviteEmail";
import { EmbedSurveyPreviewEmail } from "./components/survey/EmbedSurveyPreviewEmail";
import { LinkSurveyEmail } from "./components/survey/LinkSurveyEmail";
import { ResponseFinishedEmail } from "./components/survey/ResponseFinishedEmail";
import { NoLiveSurveyNotificationEmail } from "./components/weekly-summary/NoLiveSurveyNotificationEmail";
import { WeeklySummaryNotificationEmail } from "./components/weekly-summary/WeeklySummaryNotificationEmail";

export const IS_SMTP_CONFIGURED: boolean =
  SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASSWORD ? true : false;

interface sendEmailData {
  to: string;
  replyTo?: string;
  subject: string;
  text?: string;
  html: string;
}

interface TEmailUser {
  id: string;
  email: string;
}

export interface LinkSurveyEmailData {
  surveyId: string;
  email: string;
  suId: string;
  surveyData?:
    | {
        name?: string;
        subheading?: string;
      }
    | null
    | undefined;
}

const getEmailSubject = (productName: string): string => {
  return `${productName} User Insights - Last Week by Formbricks`;
};

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const sendEmail = async (emailData: sendEmailData) => {
  try {
    if (IS_SMTP_CONFIGURED) {
      let transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE_ENABLED, // true for 465, false for other ports
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASSWORD,
        },
        logger: DEBUG,
        debug: DEBUG,
      });
      const emailDefaults = {
        from: `Formbricks <${MAIL_FROM || "noreply@formbricks.com"}>`,
      };
      await transporter.sendMail({ ...emailDefaults, ...emailData });
    } else {
      console.error(`Could not Email :: SMTP not configured :: ${emailData.subject}`);
    }
  } catch (error) {
    throw error;
  }
};

export const sendVerificationEmail = async (user: TEmailUser) => {
  const token = createToken(user.id, user.email, {
    expiresIn: "1d",
  });
  const verifyLink = `${WEBAPP_URL}/auth/verify?token=${encodeURIComponent(token)}`;
  const verificationRequestLink = `${WEBAPP_URL}/auth/verification-requested?email=${encodeURIComponent(
    user.email
  )}`;
  await sendEmail({
    to: user.email,
    subject: "Please verify your email to use Formbricks",
    html: render(EmailTemplate({ content: VerificationEmail({ verificationRequestLink, verifyLink }) })),
  });
};

export const sendForgotPasswordEmail = async (user: TEmailUser) => {
  const token = createToken(user.id, user.email, {
    expiresIn: "1d",
  });
  const verifyLink = `${WEBAPP_URL}/auth/forgot-password/reset?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your Formbricks password",
    html: render(EmailTemplate({ content: ForgotPasswordEmail({ verifyLink }) })),
  });
};

export const sendPasswordResetNotifyEmail = async (user: TEmailUser) => {
  await sendEmail({
    to: user.email,
    subject: "Your Formbricks password has been changed",
    html: render(EmailTemplate({ content: PasswordResetNotifyEmail() })),
  });
};

export const sendInviteMemberEmail = async (
  inviteId: string,
  email: string,
  inviterName: string,
  inviteeName: string,
  isOnboardingInvite?: boolean,
  inviteMessage?: string
) => {
  const token = createInviteToken(inviteId, email, {
    expiresIn: "7d",
  });

  const verifyLink = `${WEBAPP_URL}/invite?token=${encodeURIComponent(token)}`;

  if (isOnboardingInvite && inviteMessage) {
    await sendEmail({
      to: email,
      subject: `${inviterName} needs a hand setting up Formbricks.  Can you help out?`,
      html: render(
        EmailTemplate({ content: OnboardingInviteEmail({ verifyLink, inviteMessage, inviterName }) })
      ),
    });
  } else {
    await sendEmail({
      to: email,
      subject: `You're invited to collaborate on Formbricks!`,
      html: render(EmailTemplate({ content: InviteEmail({ inviteeName, inviterName, verifyLink }) })),
    });
  }
};

export const sendInviteAcceptedEmail = async (inviterName: string, inviteeName: string, email: string) => {
  await sendEmail({
    to: email,
    subject: `You've got a new team member!`,
    html: render(EmailTemplate({ content: InviteAcceptedEmail({ inviteeName, inviterName }) })),
  });
};

export const sendResponseFinishedEmail = async (
  email: string,
  environmentId: string,
  survey: TSurvey,
  response: TResponse,
  responseCount: number
) => {
  const personEmail = response.personAttributes?.email;
  const team = await getTeamByEnvironmentId(environmentId);

  await sendEmail({
    to: email,
    subject: personEmail
      ? `${personEmail} just completed your ${survey.name} survey ✅`
      : `A response for ${survey.name} was completed ✅`,
    replyTo: personEmail?.toString() || MAIL_FROM,
    html: render(
      EmailTemplate({
        content: ResponseFinishedEmail({ survey, responseCount, response, WEBAPP_URL, environmentId, team }),
      })
    ),
  });
};

export const sendEmbedSurveyPreviewEmail = async (
  to: string,
  subject: string,
  html: string,
  environmentId: string
) => {
  await sendEmail({
    to: to,
    subject: subject,
    html: render(EmailTemplate({ content: EmbedSurveyPreviewEmail({ html, environmentId }) })),
  });
};

export const sendLinkSurveyToVerifiedEmail = async (data: LinkSurveyEmailData) => {
  const surveyId = data.surveyId;
  const email = data.email;
  const surveyData = data.surveyData;
  const singleUseId = data.suId ?? null;
  const token = createTokenForLinkSurvey(surveyId, email);
  const getSurveyLink = () => {
    if (singleUseId) {
      return `${WEBAPP_URL}/s/${surveyId}?verify=${encodeURIComponent(token)}&suId=${singleUseId}`;
    }
    return `${WEBAPP_URL}/s/${surveyId}?verify=${encodeURIComponent(token)}`;
  };
  await sendEmail({
    to: data.email,
    subject: "Your Formbricks Survey",
    html: render(EmailTemplate({ content: LinkSurveyEmail({ surveyData, getSurveyLink }) })),
  });
};

export const sendWeeklySummaryNotificationEmail = async (
  email: string,
  notificationData: TWeeklySummaryNotificationResponse
) => {
  const startDate = `${notificationData.lastWeekDate.getDate()} ${
    monthNames[notificationData.lastWeekDate.getMonth()]
  }`;
  const endDate = `${notificationData.currentDate.getDate()} ${
    monthNames[notificationData.currentDate.getMonth()]
  }`;
  const startYear = notificationData.lastWeekDate.getFullYear();
  const endYear = notificationData.currentDate.getFullYear();
  await sendEmail({
    to: email,
    subject: getEmailSubject(notificationData.productName),
    html: render(
      EmailTemplate({
        content: WeeklySummaryNotificationEmail({
          notificationData,
          startDate,
          endDate,
          startYear,
          endYear,
        }),
      })
    ),
  });
};

export const sendNoLiveSurveyNotificationEmail = async (
  email: string,
  notificationData: TWeeklySummaryNotificationResponse
) => {
  const startDate = `${notificationData.lastWeekDate.getDate()} ${
    monthNames[notificationData.lastWeekDate.getMonth()]
  }`;
  const endDate = `${notificationData.currentDate.getDate()} ${
    monthNames[notificationData.currentDate.getMonth()]
  }`;
  const startYear = notificationData.lastWeekDate.getFullYear();
  const endYear = notificationData.currentDate.getFullYear();
  await sendEmail({
    to: email,
    subject: getEmailSubject(notificationData.productName),
    html: render(
      EmailTemplate({
        content: NoLiveSurveyNotificationEmail({
          notificationData,
          startDate,
          endDate,
          startYear,
          endYear,
        }),
      })
    ),
  });
};

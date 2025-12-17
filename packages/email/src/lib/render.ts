import { render } from "@react-email/render";
import { ForgotPasswordEmail } from "../../emails/auth/forgot-password-email";
import { NewEmailVerification } from "../../emails/auth/new-email-verification";
import { PasswordResetNotifyEmail } from "../../emails/auth/password-reset-notify-email";
import { VerificationEmail } from "../../emails/auth/verification-email";
import { EmailCustomizationPreviewEmail } from "../../emails/general/email-customization-preview-email";
import { InviteAcceptedEmail } from "../../emails/invite/invite-accepted-email";
import { InviteEmail } from "../../emails/invite/invite-email";
import { EmbedSurveyPreviewEmail } from "../../emails/survey/embed-survey-preview-email";
import { FollowUpEmail, FollowUpEmailProps } from "../../emails/survey/follow-up-email";
import { LinkSurveyEmail } from "../../emails/survey/link-survey-email";
import {
  ResponseFinishedEmail,
  ResponseFinishedEmailProps,
} from "../../emails/survey/response-finished-email";

type TFunction = (key: string, replacements?: Record<string, string>) => string;

export async function renderVerificationEmail(props: {
  verifyLink: string;
  verificationRequestLink: string;
  t: TFunction;
}): Promise<string> {
  return await render(VerificationEmail(props));
}

export async function renderForgotPasswordEmail(props: {
  verifyLink: string;
  t: TFunction;
}): Promise<string> {
  return await render(ForgotPasswordEmail(props));
}

export async function renderNewEmailVerification(props: {
  verifyLink: string;
  t: TFunction;
}): Promise<string> {
  return await render(NewEmailVerification(props));
}

export async function renderPasswordResetNotifyEmail(props: { t: TFunction }): Promise<string> {
  return await render(PasswordResetNotifyEmail(props));
}

export async function renderInviteEmail(props: {
  inviteeName: string;
  inviterName: string;
  verifyLink: string;
  t: TFunction;
}): Promise<string> {
  return await render(InviteEmail(props));
}

export async function renderInviteAcceptedEmail(props: {
  inviterName: string;
  inviteeName: string;
  t: TFunction;
}): Promise<string> {
  return await render(InviteAcceptedEmail(props));
}

export async function renderLinkSurveyEmail(props: {
  surveyName: string;
  surveyLink: string;
  logoUrl: string;
  t: TFunction;
}): Promise<string> {
  return await render(LinkSurveyEmail(props));
}

export async function renderEmbedSurveyPreviewEmail(props: {
  html: string;
  environmentId: string;
  logoUrl?: string;
  t: TFunction;
}): Promise<string> {
  return await render(EmbedSurveyPreviewEmail(props));
}

export async function renderResponseFinishedEmail(props: ResponseFinishedEmailProps): Promise<string> {
  return await render(ResponseFinishedEmail(props));
}

export async function renderEmailCustomizationPreviewEmail(props: {
  userName: string;
  logoUrl?: string;
  t: TFunction;
}): Promise<string> {
  return await render(EmailCustomizationPreviewEmail(props));
}

export async function renderFollowUpEmail(props: FollowUpEmailProps): Promise<string> {
  return await render(FollowUpEmail(props));
}

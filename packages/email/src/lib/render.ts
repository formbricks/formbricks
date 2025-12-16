import { render } from "@react-email/render";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { FollowUpEmailProps } from "@/emails/survey/follow-up-email";
import { ResponseFinishedEmailProps } from "@/emails/survey/response-finished-email";
import {
  EmailCustomizationPreviewEmail,
  EmbedSurveyPreviewEmail,
  FollowUpEmail,
  ForgotPasswordEmail,
  InviteAcceptedEmail,
  InviteEmail,
  LinkSurveyEmail,
  NewEmailVerification,
  PasswordResetNotifyEmail,
  ResponseFinishedEmail,
  VerificationEmail,
} from "@/src/index";

type TFunction = (key: string, replacements?: Record<string, string>) => string;

// Render helper functions that convert React email components to HTML strings
// These are used by the web app to send emails without needing to import react-email

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

// Follow-up email types - exported for web app use
export interface ProcessedResponseElement {
  element: string;
  response: string | string[];
  type: TSurveyElementTypeEnum;
}

export interface ProcessedVariable {
  id: string;
  name: string;
  type: "text" | "number";
  value: string | number;
}

export interface ProcessedHiddenField {
  id: string;
  value: string;
}

export async function renderFollowUpEmail(props: FollowUpEmailProps): Promise<string> {
  return await render(FollowUpEmail(props));
}

import { TResponse } from "@formbricks/types/responses";
import { TSurvey, TSurveyQuestionType } from "@formbricks/types/surveys";

import {
  DEBUG,
  MAIL_FROM,
  SMTP_HOST,
  SMTP_PASSWORD,
  SMTP_PORT,
  SMTP_SECURE_ENABLED,
  SMTP_USER,
  WEBAPP_URL,
} from "../constants";
import { createInviteToken, createToken, createTokenForLinkSurvey } from "../jwt";
import { getProductByEnvironmentId } from "../product/service";
import { getQuestionResponseMapping } from "../responses";
import { getOriginalFileNameFromUrl } from "../storage/utils";
import { getTeamByEnvironmentId } from "../team/service";
import { withEmailTemplate } from "./email-template";

const nodemailer = require("nodemailer");

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
  surveyData?: {
    name?: string;
    subheading?: string;
  } | null;
}

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
    html: withEmailTemplate(`<h1>Almost there!</h1>
    To start using Formbricks please verify your email below:<br/><br/>
    <a class="button" href="${verifyLink}">Verify email</a><br/><br/>
    You can also click on this link:<br/>
    <a href="${verifyLink}" style="word-break: break-all; color: #1e293b;">${verifyLink}</a><br/><br/>
    <strong>The link is valid for 24h.</strong><br/><br/>If it has expired please request a new token here:
    <a href="${verificationRequestLink}">Request new verification</a><br/>
    <br/>
    Your Formbricks Team`),
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
    html: withEmailTemplate(`<h1>Change password</h1>
    You have requested a link to change your password. You can do this by clicking the link below:<br/><br/>
    <a class="button" href="${verifyLink}">Change password</a><br/>
    <br/>
    <strong>The link is valid for 24 hours.</strong><br/><br/>If you didn't request this, please ignore this email.<br/>
    Your Formbricks Team`),
  });
};

export const sendPasswordResetNotifyEmail = async (user: TEmailUser) => {
  await sendEmail({
    to: user.email,
    subject: "Your Formbricks password has been changed",
    html: withEmailTemplate(`<h1>Password changed</h1>
    Your password has been changed successfully.<br/>
    <br/>
    Your Formbricks Team`),
  });
};

export const sendInviteMemberEmail = async (
  inviteId: string,
  email: string,
  inviterName: string | null,
  inviteeName: string | null,
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
      html: withEmailTemplate(`Hey 👋,<br/><br/>
      ${inviteMessage} 
      <h2>Get Started in Minutes</h2>
    <ol>
        <li>Create an account to join ${inviterName}'s team.</li>
        <li>Connect Formbricks to your app or website via HTML Snippet or NPM in just a few minutes.</li>
        <li>Done ✅</li>
    </ol>
      <a class="button" href="${verifyLink}">Join ${inviterName}'s team</a><br/>
      <br/>
      Have a great day!<br/>
      The Formbricks Team!`),
    });
  } else {
    await sendEmail({
      to: email,
      subject: `You're invited to collaborate on Formbricks!`,
      html: withEmailTemplate(`Hey ${inviteeName},<br/><br/>
      Your colleague ${inviterName} invited you to join them at Formbricks. To accept the invitation, please click the link below:<br/><br/>
      <a class="button" href="${verifyLink}">Join team</a><br/>
      <br/>
      Have a great day!<br/>
      The Formbricks Team!`),
    });
  }
};

export const sendInviteAcceptedEmail = async (inviterName: string, inviteeName: string, email: string) => {
  await sendEmail({
    to: email,
    subject: `You've got a new team member!`,
    html: withEmailTemplate(`Hey ${inviterName},
    <br/><br/>
    Just letting you know that ${inviteeName} accepted your invitation. Have fun collaborating!
    <br/><br/>
    Have a great day!<br/>
    The Formbricks Team!`),
  });
};

export const sendResponseFinishedEmail = async (
  email: string,
  environmentId: string,
  survey: TSurvey,
  response: TResponse,
  responseCount: number
) => {
  const personEmail = response.person?.attributes["email"];
  const team = await getTeamByEnvironmentId(environmentId);
  const product = await getProductByEnvironmentId(environmentId);
  if (!product) return;
  await sendEmail({
    to: email,
    subject: personEmail
      ? `${personEmail} just completed your ${survey.name} survey ✅`
      : `A response for ${survey.name} was completed ✅`,
    replyTo: personEmail?.toString() || MAIL_FROM,
    html: withEmailTemplate(`
      <h1>Hey 👋</h1>
      <p>Congrats, you received a new response to your survey!
      Someone just completed your survey <strong>${survey.name}:</strong><br/></p>

      <hr/>

      ${getQuestionResponseMapping(survey, response)
        .map(
          (question) =>
            question.answer &&
            `<div style="margin-top:1em;">
            <p style="margin:0px;">${question.question}</p>
            ${
              question.type === TSurveyQuestionType.FileUpload
                ? typeof question.answer !== "string" &&
                  question.answer
                    .map((answer) => {
                      return `
                  <div style="position: relative; display: flex; width: 15rem; flex-direction: column; align-items: center; justify-content: center; border-radius: 0.5rem; background-color: #e2e8f0; color: black; margin-top:8px;">
                    <div style="margin-top: 1rem; color: black;">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-file">
                        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                      </svg>
                    </div>
                    <p style="margin-top: 0.5rem; width: 80%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 1rem; font-size: 0.875rem; color: black;">
                    ${getOriginalFileNameFromUrl(answer)}
                    </p>
                  </div>
               `;
                    })
                    .join("")
                : `<p style="margin:0px; white-space:pre-wrap"><b>${question.answer}</b></p>`
            }
            
          </div>`
        )
        .join("")}

      <a class="button" href="${WEBAPP_URL}/environments/${environmentId}/surveys/${
        survey.id
      }/responses?utm_source=email_notification&utm_medium=email&utm_content=view_responses_CTA">${responseCount > 1 ? `View ${responseCount - 1} more ${responseCount === 2 ? "response" : "responses"}` : `View survey summary`}</a>

      <hr/>
     
      <div style="margin-top:0.8em; padding:0.01em 1.6em; text-align:center; font-size:0.8em; line-height:1.2em;">
      <p><b>Don't want to get these notifications?</b></p>
      <p>Turn off notifications for <a href="${WEBAPP_URL}/environments/${environmentId}/settings/notifications?type=alert&elementId=${survey.id}">this form</a>. 
      <br/> Turn off notifications for <a href="${WEBAPP_URL}/environments/${environmentId}/settings/notifications?type=unsubscribedTeamIds&elementId=${team?.id}">all newly created forms</a>.</p></div>
    `),
  });
};

export const sendEmbedSurveyPreviewEmail = async (to: string, subject: string, html: string) => {
  await sendEmail({
    to: to,
    subject: subject,
    html: withEmailTemplate(`
    <h1>Preview Email Embed</h1>
    <p>This is how the code snippet looks embedded into an email:</p>
    ${html}`),
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
    html: withEmailTemplate(`<h1>Hey 👋</h1>
    Thanks for validating your email. Here is your Survey.<br/><br/>
    <strong>${surveyData?.name}</strong>
    <p>${surveyData?.subheading}</p>
    <a class="button" href="${getSurveyLink()}">Take survey</a><br/>
    <br/>
    All the best,<br/>
    Your Formbricks Team 🤍`),
  });
};

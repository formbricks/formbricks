import { TResponse } from "@formbricks/types/responses";
import { TSurveyQuestion } from "@formbricks/types/surveys";

import {
  MAIL_FROM,
  SMTP_HOST,
  SMTP_PASSWORD,
  SMTP_PORT,
  SMTP_SECURE_ENABLED,
  SMTP_USER,
  WEBAPP_URL,
} from "../constants";
import { createInviteToken, createToken, createTokenForLinkSurvey } from "../jwt";
import { getQuestionResponseMapping } from "../responses";
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

interface TEmailUserWithName extends TEmailUser {
  name: string | null;
}

export interface LinkSurveyEmailData {
  surveyId: string;
  email: string;
  surveyData?: {
    name?: string;
    subheading?: string;
  } | null;
}

export const sendEmail = async (emailData: sendEmailData) => {
  try {
    if (!IS_SMTP_CONFIGURED) throw new Error("Could not Email: SMTP not configured");

    let transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE_ENABLED, // true for 465, false for other ports
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
      // logger: true,
      // debug: true,
    });
    const emailDefaults = {
      from: `Formbricks <${MAIL_FROM || "noreply@formbricks.com"}>`,
    };
    await transporter.sendMail({ ...emailDefaults, ...emailData });
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
    subject: "Verify your Formbricks Email",
    html: withEmailTemplate(`<h1>Welcome!</h1>
    To start using Formbricks please verify your email by clicking the button below:<br/><br/>
    <a class="button" href="${verifyLink}">Confirm email</a><br/>
    <br/>
    <strong>The link is valid for 24h.</strong><br/><br/>If it has expired please request a new token here:
    <a href="${verificationRequestLink}">Request new verification</a><br/>
    <br/>
    Your Formbricks Team`),
  });
};

export const sendGettingStartedEmail = async (user: TEmailUserWithName) => {
  await sendEmail({
    to: user.email,
    subject: "Get started with Formbricks 🤍",
    html: withEmailTemplate(`
    <p>Dear ${user.name || "friend"},</p>
    <p>Welcome aboard, and thank you for choosing Formbricks - we’re thrilled to have you!</p>
    <h4>First Impressions Count</h4>
    <p>You’ve likely already had a look around Formbricks - love it! What's your first impression? Any issues getting started? Wanna share some love? Please <a href="https://app.formbricks.com/s/clqe9gpsi0572114z052uig9j?userId=${
      user.id
    }">leave a quick note for the team here</a>, takes literally 10 seconds 🤸</p>
    <h3>No Matter the Channel, Formbricks Can Handle Your Feedback</h3>
    <p>Our open source survey platform is really powerful. Run:</p>
    <ul>
        <li>Website Surveys like HotJar Ask</li>
        <li>In-App Surveys like Sprig</li>
        <li>Link Surveys like Typeform</li>
        <li>Headless Surveys via API</li>
    </ul>
    <p>You're missing something? <a href="https://github.com/formbricks/formbricks/issues/new?assignees=&labels=enhancement&projects=&template=feature_request.yml&title=%5BFEATURE%5D"> Request it</a> and we'll build it 👷</p>
    <b>Best Practices with Formbricks</b>
    <p>We've created a list with the use cases which are most popular among Formbricks user. Maybe they inspire you to harvest more user insights as well:</p>
    <ul>
        <li><a href="https://formbricks.com/docs/best-practices/cancel-subscription">Learn from Churn</a></li>
        <li><a href="https://formbricks.com/docs/best-practices/interview-prompt">Interview Prompts</a> with Power Users</li>
        <li>Measure <a href="https://formbricks.com/docs/best-practices/pmf-survey">Product-Market Fit</a></li>
        <li><a href="https://formbricks.com/docs/best-practices/improve-trial-cr">Improve Trial Conversion</a></li>
        <li><a href="https://formbricks.com/docs/best-practices/feedback-box">Feedback Box</a></li>
        <li><a href="https://formbricks.com/docs/best-practices/feature-chaser">Feature Follow Up</a></li>
        <li><a href="https://formbricks.com/docs/best-practices/docs-feedback">Docs Feedback</a></li>
    </ul>
    <b>Join Our Community</b>
    <p>Formbricks is powered by an open source survey platform. We're building it with our community - come and join us to share ideas, feedback and contribute.</p>
    <a class="button" href="https://formbricks.com/discord">Join Discord</a><br/><br/>
    <h2>Privacy-first Experience Management</h2>
    <p>Your privacy and security are paramount. Formbricks is GDRP and CCPA compliant. We also make self-hosting really easy to maintain full control over your data. Feel free to reach out to <a href="mailto:privacy@formbricks.com">privacy@formbricks.com</a> with any questions.</p>
    <p>Once again, <strong>welcome to the Formbricks family!</strong> We can’t wait to see what you’ll craft.</p>
    <p>Life is too short for mediocre products,<br>
    craft an irresistible experience.</p>
    <p>The Formbricks Team</p>    
    `),
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
  inviteeName: string | null
) => {
  const token = createInviteToken(inviteId, email, {
    expiresIn: "7d",
  });

  const verifyLink = `${WEBAPP_URL}/invite?token=${encodeURIComponent(token)}`;

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
  survey: { id: string; name: string; questions: TSurveyQuestion[] },
  response: TResponse
) => {
  const personEmail = response.person?.attributes["email"];
  await sendEmail({
    to: email,
    subject: personEmail
      ? `${personEmail} just completed your ${survey.name} survey ✅`
      : `A response for ${survey.name} was completed ✅`,
    replyTo: personEmail?.toString() || MAIL_FROM,
    html: withEmailTemplate(`<h1>Hey 👋</h1>Someone just completed your survey <strong>${
      survey.name
    }</strong><br/>

    <hr/>

    ${getQuestionResponseMapping(survey, response)
      .map(
        (question) =>
          question.answer &&
          `<div style="margin-top:1em;">
          <p style="margin:0px;">${question.question}</p>
          <p style="font-weight: 500; margin:0px; white-space:pre-wrap">${question.answer}</p>  
        </div>`
      )
      .join("")}

    <a class="button" href="${WEBAPP_URL}/environments/${environmentId}/surveys/${
      survey.id
    }/responses?utm_source=emailnotification&utm_medium=email&utm_content=ViewResponsesCTA">View all responses</a>

    <div class="tooltip">
    <p class='brandcolor'><strong>Start a conversation 💡</strong></p>
    ${
      personEmail
        ? `<p>Hit 'Reply' or reach out manually: ${personEmail}</p>`
        : "<p>If you set the email address as an attribute in in-app surveys, you can reply directly to the respondent.</p>"
    }
    </div>
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
  const token = createTokenForLinkSurvey(surveyId, email);
  const surveyLink = `${WEBAPP_URL}/s/${surveyId}?verify=${encodeURIComponent(token)}`;
  await sendEmail({
    to: data.email,
    subject: "Your Formbricks Survey",
    html: withEmailTemplate(`<h1>Hey 👋</h1>
    Thanks for validating your email. Here is your Survey.<br/><br/>
    <strong>${surveyData?.name}</strong>
    <p>${surveyData?.subheading}</p>
    <a class="button" href="${surveyLink}">Take survey</a><br/>
    <br/>
    All the best,<br/>
    Your Formbricks Team 🤍`),
  });
};

import { getQuestionResponseMapping } from "@/lib/responses/questionResponseMapping";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { Question } from "@formbricks/types/questions";
import { Response } from "@formbricks/types/responses";
import { AttributeClass } from "@prisma/client";
import { withEmailTemplate } from "./email-template";
import { createInviteToken, createToken } from "./jwt";

const nodemailer = require("nodemailer");

interface sendEmailData {
  to: string;
  replyTo?: string;
  subject: string;
  text?: string;
  html: string;
}

const sendEmail = async (emailData: sendEmailData) => {
  let transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE_ENABLED === "1", // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    // logger: true,
    // debug: true,
  });
  const emailDefaults = {
    from: `Formbricks <${process.env.MAIL_FROM || "noreply@formbricks.com"}>`,
  };
  await transporter.sendMail({ ...emailDefaults, ...emailData });
};

export const sendVerificationEmail = async (user) => {
  const token = createToken(user.id, user.email, {
    expiresIn: "1d",
  });
  const verifyLink = `${WEBAPP_URL}/auth/verify?token=${encodeURIComponent(token)}`;
  const verificationRequestLink = `${WEBAPP_URL}/auth/verification-requested?email=${encodeURIComponent(
    user.email
  )}`;
  await sendEmail({
    to: user.email,
    subject: "Welcome to Formbricks 🤍",
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

export const sendForgotPasswordEmail = async (user) => {
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

export const sendPasswordResetNotifyEmail = async (user) => {
  await sendEmail({
    to: user.email,
    subject: "Your Formbricks password has been changed",
    html: withEmailTemplate(`<h1>Password changed</h1>
    Your password has been changed successfully.<br/>
    <br/>
    Your Formbricks Team`),
  });
};

export const sendInviteMemberEmail = async (inviteId, inviterName, inviteeName, email) => {
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

export const sendInviteAcceptedEmail = async (inviterName, inviteeName, email) => {
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
  survey: { id: string; name: string; questions: Question[] },
  response: Response,
  person: { id: string; attributes: { id: string; value: string; attributeClass: AttributeClass }[] } | null
) => {
  const personEmail = person?.attributes?.find((a) => a.attributeClass?.name === "email")?.value;
  await sendEmail({
    to: email,
    subject: personEmail
      ? `${personEmail} just completed your ${survey.name} survey ✅`
      : `A response for ${survey.name} was completed ✅`,
    replyTo: personEmail || process.env.MAIL_FROM,
    html: withEmailTemplate(`<h1>Survey completed</h1>Someone just completed your survey "${survey.name}"<br/>

    <hr/> 

    ${getQuestionResponseMapping(survey, response)
      .map(
        (question) =>
          question.answer && `<p><strong>${question.question}</strong></p><p>${question.answer}</p>`
      )
      .join("")} 
   
    <hr/>

    <div class="tooltip">
    <p class='brandcolor'><strong>Did you know? 💡</strong></p>
    ${
      personEmail
        ? "<p>You can reply to this email to start a conversation with this user.</p>"
        : "<p>If you set the email address as an attribute in in-app surveys, you can reply directly to the respondent.</p>"
    }
    </div>
    
    <a class="button" href="${WEBAPP_URL}/environments/${environmentId}/surveys/${
      survey.id
    }/responses">View response</a>
    `),
  });
};

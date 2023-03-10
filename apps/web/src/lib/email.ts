import { withEmailTemplate } from "./email-template";
import { createToken } from "./jwt";
import { MergeWithSchema } from "./submissions";
const nodemailer = require("nodemailer");

interface sendEmailData {
  to: string;
  replyTo?: string;
  subject: string;
  text?: string;
  html: string;
}

export const sendEmail = async (emailData: sendEmailData) => {
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
  const verifyLink = `${process.env.NEXTAUTH_URL}/auth/verify?token=${encodeURIComponent(token)}`;
  const verificationRequestLink = `${
    process.env.NEXTAUTH_URL
  }/auth/verification-requested?email=${encodeURIComponent(user.email)}`;
  await sendEmail({
    to: user.email,
    subject: "Welcome to Formbricks 🤍",
    html: withEmailTemplate(`<h1>Welcome!</h1>
    To start using Formbricks please verify your email by clicking the button below:<br/><br/>
    <a class="button" href="${verifyLink}">Verify email</a><br/>
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
  const verifyLink = `${process.env.NEXTAUTH_URL}/auth/forgot-password/reset?token=${encodeURIComponent(
    token
  )}`;
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

export const sendSubmissionEmail = async (
  email: string,
  event: "created" | "updated" | "finished",
  organisationId,
  formId,
  formLabel: string,
  schema: any,
  submission: any
) => {
  await sendEmail({
    to: email,
    subject:
      event === "created"
        ? `You got a new submission for ${formLabel} 🎉`
        : event === "updated"
        ? `Someone update a submission for ${formLabel}`
        : event === "finished"
        ? `A submission for ${formLabel} was completed ✅`
        : `A submission for ${formLabel} was updated.`,
    replyTo: submission.customerEmail || process.env.MAIL_FROM,
    html: withEmailTemplate(`${
      event === "created"
        ? `<h1>New submission</h1>Someone just started filling out your form "${formLabel}":`
        : event === "updated"
        ? `<h1>Submission Update</h1>A submission in "${formLabel}" just received an update.`
        : event === "finished"
        ? `<h1>Form completed</h1>Someone just completed your form "${formLabel}":`
        : ""
    }<br/>

    <hr/>

    ${Object.entries(MergeWithSchema(submission.data, schema))
      .map(([key, value]) => `<p><strong>${key}</strong></p><p>${value}</p>`)
      .join("")}

   
    <hr/>

    <div class="tooltip">
    <p class='brandcolor'><strong>Did you know? 💡</strong></p>
    ${
      submission.customerEmail
        ? "<p>You can reply to this email to start a conversation with this user.</p>"
        : "<p>You can add the respondents email to the submission and then simply hit 'Reply to' to start a conversation with your respondent. <a href='https://formbricks.com/docs/best-practices/feedback-box#add-user-email'>Here's how.</a></p>"
    }
    </div>
    
    <a class="button" href="${
      process.env.NEXTAUTH_URL
    }/organisations/${organisationId}/forms/${formId}/feedback">View submission</a>
    `),
  });
};

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
    subject: "Welcome to Formbricks",
    html: `Welcome to Formbricks!<br/><br/>To verify your email address and start using Formbricks please click this link:<br/>
    <a href="${verifyLink}">${verifyLink}</a><br/>
    <br/>
    The link is valid for one day. If it has expired please request a new token here:<br/>
    <a href="${verificationRequestLink}">${verificationRequestLink}</a><br/>
    <br/>
    Your Formbricks Organisation`,
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
    html: `You have requested a link to change your password. You can do this through the link below:<br/>
    <a href="${verifyLink}">${verifyLink}</a><br/>
    <br/>
    The link is valid for 24 hours. If you didn't request this, please ignore this email.<br/>
    <br/>
    Your password won't change until you access the link above and create a new one.<br/>
    <br/>
    Your Formbricks Organisation`,
  });
};

export const sendPasswordResetNotifyEmail = async (user) => {
  await sendEmail({
    to: user.email,
    subject: "Your Formbricks password has been changed",
    html: `We're contacting you to notify you that your password has been changed.<br/>
    <br/>
    Your Formbricks Organisation`,
  });
};

export const sendSubmissionEmail = async (
  email: string,
  event: "created" | "updated" | "finished",
  organisationId,
  formId,
  formLabel: string,
  schema: any,
  submission
) => {
  await sendEmail({
    to: email,
    subject:
      event === "created"
        ? `${formLabel} new submission created`
        : event === "updated"
        ? `${formLabel} submission updated`
        : event === "finished"
        ? `${formLabel} submission finished`
        : `${formLabel} submission update`,
    replyTo: submission.customer?.email || process.env.MAIL_FROM,
    html: `${
      event === "created"
        ? `Hey, someone just filled out your form "${formLabel}" in Formbricks.`
        : event === "updated"
        ? `Hey, a submission in "${formLabel}" in Formbricks just received an update.`
        : event === "finished"
        ? `Hey, someone just finished your form "${formLabel}" in Formbricks.`
        : ""
    }<br/>

    <hr/>

    ${Object.entries(MergeWithSchema(submission.data, schema))
      .map(([key, value]) => `<p><strong>${key}</strong></p><p>${value}</p>`)
      .join("")}

    <hr/>
    
    Click <a href="${
      process.env.NEXTAUTH_URL
    }/organisations/${organisationId}/forms/${formId}/feedback">here</a> to see the submission.
    ${submission.customerEmail ? "<hr/>You can reply to this email to contact the user directly." : ""}`,
  });
};

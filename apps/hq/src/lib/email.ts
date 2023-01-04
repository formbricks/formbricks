import { createToken } from "./jwt";
const nodemailer = require("nodemailer");

interface sendEmailData {
  to: string;
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
    Your Formbricks Team`,
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
    Your Formbricks Team`,
  });
};

export const sendPasswordResetNotifyEmail = async (user) => {
  await sendEmail({
    to: user.email,
    subject: "Your Formbricks password has been changed",
    html: `We're contacting you to notify you that your password has been changed.<br/>
    <br/>
    Your Formbricks Team`,
  });
};

export const sendSubmissionEmail = async (
  email: string,
  formId,
  formLabel: string,
  schema: any,
  submission
) => {
  const MergeWithSchema = (submissionData, schema) => {
    if (Object.keys(schema).length === 0) {
      // no schema provided
      return submissionData;
    }
    const mergedData = {};
    for (const elem of schema.children) {
      if (["submit"].includes(elem.type)) {
        continue;
      }
      if (elem.name in submissionData) {
        mergedData[elem.label] = submissionData[elem.name];
      } else {
        mergedData[elem.label] = "not provided";
      }
    }
    return mergedData;
  };

  await sendEmail({
    to: email,
    subject: `${formLabel} new submission`,
    html: `Hey, someone just filled out your form ${formLabel} in Formbricks.<br/>

    <hr/>

    ${Object.entries(MergeWithSchema(submission.data, schema))
      .map(([key, value]) => `<p><strong>${key}</strong></p><p>${value}</p>`)
      .join("")}

    <hr/>
    
    Click <a href="${
      process.env.NEXTAUTH_URL
    }/forms/${formId}/results/responses">here</a> to see new submission`,
  });
};

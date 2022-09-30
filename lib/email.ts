import getConfig from "next/config";
import { createToken } from "./jwt";
const nodemailer = require("nodemailer");

const { serverRuntimeConfig } = getConfig();

interface sendEmailData {
  to: string;
  subject: string;
  text?: string;
  html: string;
}

export const sendEmail = async (emailData: sendEmailData) => {
  let transporter = nodemailer.createTransport({
    host: serverRuntimeConfig.smtpHost,
    port: serverRuntimeConfig.smtpPort,
    secure: serverRuntimeConfig.smtpSecureEnabled, // true for 465, false for other ports
    auth: {
      user: serverRuntimeConfig.smtpUser,
      pass: serverRuntimeConfig.smtpPassword,
    },
    // logger: true,
    // debug: true,
  });
  const emailDefaults = {
    from: `Kinshasa Digital Academy <${
      serverRuntimeConfig.mailFrom || "noreply@snoopforms.com"
    }>`,
  };
  await transporter.sendMail({ ...emailDefaults, ...emailData });
};

export const sendVerificationEmail = async (user) => {
  const token = createToken(user.id, user.email, {
    expiresIn: "1d",
  })
  const verifyLink = `${
    serverRuntimeConfig.nextauthUrl
  }/auth/verify?token=${encodeURIComponent(token)}`;
  const verificationRequestLink = `${
    serverRuntimeConfig.nextauthUrl
  }/auth/verification-requested?email=${encodeURIComponent(user.email)}`;
  await sendEmail({
    to: user.email,
    subject: "Welcome to KDA Sourcing",
    html: `Welcome to KDA Sourcing!<br/><br/>To verify your email address and start using KDA Sourcing please click this <a href="${verifyLink}">link</a>!
    <br/>
    The link is valid for one day. If it has expired please <a href="${verificationRequestLink}">request a new token</a>!<br/>
    <br/>
    Your KDA Team`,
  });
};

export const sendForgotPasswordEmail = async (user) => {
  const token = createToken(user.id, user.email, {
    expiresIn: "1d",
  })
  const verifyLink = `${
    serverRuntimeConfig.nextauthUrl
  }/auth/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your KDA Sourcing password",
    html: `You have requested a link to change your password. You can do this through the link below:<br/>
    <a href="${verifyLink}">${verifyLink}</a><br/>
    <br/>
    The link is valid for 24 hours. If you didn't request this, please ignore this email.<br/>
    <br/>
    Your password won't change until you access the link above and create a new one.<br/>
    <br/>
    Your KDA Team`,
  });
};

export const sendPasswordResetNotifyEmail = async (user) => {
  await sendEmail({
    to: user.email,
    subject: "Your KDA Sourcing password has been changed",
    html: `We're contacting you to notify you that your password has been changed.<br/>
    <br/>
    Your KDA Team`,
  });
};

import getConfig from "next/config";
import jwt from "jsonwebtoken";
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
    secure: serverRuntimeConfig.smtpSecureEnabled || false, // true for 465, false for other ports
    auth: {
      user: serverRuntimeConfig.smtpUser,
      pass: serverRuntimeConfig.smtpPassword,
    },
    // logger: true,
    // debug: true,
  });
  const emailDefaults = {
    from: `snoopForms <${
      serverRuntimeConfig.mailFrom || "noreply@snoopforms.com"
    }>`,
  };
  await transporter.sendMail({ ...emailDefaults, ...emailData });
};

export const sendVerificationEmail = async (user) => {
  const token = jwt.sign(
    { id: user.id },
    serverRuntimeConfig.nextauthSecret + user.email,
    {
      expiresIn: "1d",
    }
  );
  const verifyLink = `${
    serverRuntimeConfig.nextauthUrl
  }/auth/verify?token=${encodeURIComponent(token)}`;
  const verificationRequestLink = `${
    serverRuntimeConfig.nextauthUrl
  }/auth/verification-requested?email=${encodeURIComponent(user.email)}`;
  await sendEmail({
    to: user.email,
    subject: "Welcome to snoopForms",
    html: `Welcome to snoopForms!<br/><br/>To verify your email address and start using snoopForms please click this link:<br/>
    <a href="${verifyLink}">${verifyLink}</a><br/>
    <br/>
    The link is valid for one day. If it has expired please request a new token here:<br/>
    <a href="${verificationRequestLink}">${verificationRequestLink}</a><br/>
    <br/>
    Your snoopForms Team`,
  });
};
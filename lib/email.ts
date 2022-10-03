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
    from: serverRuntimeConfig.smtpUser,
    // logger: true,
    // debug: true,
  });
  const emailDefaults = {
    from: `Kinshasa Digital Academy <${
      serverRuntimeConfig.smtpUser || "noreply@kinshasadigital.com" //user:serverRuntimeConfig.mailFrom
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
    subject: "Bienvenue sur le site de KDA Sourcing",
    html: `Bienvenue sur le site de KDA Sourcing!<br/><br/>Pour vérifier votre adresse e-mail et commencer à utiliser KDA Sourcing, veuillez cliquer sur ce <a href="${verifyLink}">lien</a>!
    <br/>
    Le lien est valide pour une journée. S'il a expiré, <a href="${verificationRequestLink}">veuillez en demander un nouveau</a>!<br/>
    <br/>
    L'équipe KDA`,
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

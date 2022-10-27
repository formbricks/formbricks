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
    subject: "Réinitialiser votre mot de passe KDA Sourcing",
    html: `Vous avez demandé un lien pour changer votre mot de passe. Vous pouvez le faire en cliquant sur le lien ci-dessous :<br/>
    <a href="${verifyLink}">${verifyLink}</a><br/>
    <br/>
    Le lien est valable pendant 24 heures. Si vous ne l'avez pas demandé, veuillez ignorer cet e-mail.<br/>
    <br/>
    Votre mot de passe ne changera pas tant que vous n'aurez pas accédé au lien ci-dessus et créé un nouveau mot de passe.<br/>
    <br/>
    L'équipe KDA`,
  });
};

export const sendPasswordResetNotifyEmail = async (user) => {
  await sendEmail({
    to: user.email,
    subject: "Votre mot de passe KDA Sourcing a été changé",
    html: `Nous vous contactons pour vous informer que votre mot de passe a été modifié.<br/>
    <br/>
    L'équipe KDA`,
  });
};

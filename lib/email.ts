import getConfig from "next/config";
import { createToken } from "./jwt";
const nodemailer = require("nodemailer");

const { serverRuntimeConfig } = getConfig();

interface sendEmailData {
  to: string;
  subject: string;
  text?: string;
  html: string;
  from?: string;
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
    from: `Kadea Academy <${ serverRuntimeConfig.mailFrom || serverRuntimeConfig.smtpUser }>`,
    // logger: true,
    // debug: true,
  });
  await transporter.sendMail(emailData);
};

export const sendVerificationEmail = async (user, url = "/sourcings") => {
  const token = createToken(user.id, user.email, {
    expiresIn: "1d",
  });
  const verifyLink = `${serverRuntimeConfig.nextauthUrl
    }/auth/verify?token=${encodeURIComponent(
      token
    )}&callbackUrl=${encodeURIComponent(url)}`;

  const verificationRequestLink = `${serverRuntimeConfig.nextauthUrl
    }/auth/verification-requested?email=${encodeURIComponent(
      user.email
    )}&callbackUrl=${encodeURIComponent(url)}`;
  await sendEmail({
    to: user.email,
    from: `Jean-Louis Mbaka <${ serverRuntimeConfig.smtpUser }>`,
    subject: `Merci pour ton enregistrement ${user.firstname} x Kadea Academy !`,
    html: `<div>
      <p>Hello ${user.firstname} !</p>
      <p>Merci de t’être enregistré à Kadea Academy.</p>
      <p>Je suis ravi de t'accueillir parmi nous.</p>
      <p>La prochaine étape de ton processus d'inscription consiste à passer ce <a href="${verifyLink}">test en ligne</a>, 
      non ce n’est pas un test pour évaluer ton niveau de code mais pour :</p>
      <ul>
        <li>Évaluer ta motivation</li>
        <li>Sentir ta détermination</li>
        <li>Comprendre tes objectifs</li>
      </ul>

      <p>Suite à ce test Gail, notre responsable admission te contactera pour répondre à toutes tes questions.</p>
      <p>Est-ce que cela te convient ?</p><br/>
      <div style="margin: auto; text-align: center;">
        <a href="${verifyLink}" style="background-color: rgba(245, 59, 87); color:#fff; padding:8px; border: 2px solid red; margin: auto; border-radius: 15px;">Commencer le test en ligne</a>
      </div>
      <br/>
    <p>Le lien est valide pour une journée. S'il a expiré, tu peux générer un nouveau <a href="${verificationRequestLink}">lien en cliquant ici !</a>!</p>
    <p>À très bientôt</p><br/>
    <p>Jean-Louis MBAKA</p>
    <p>Directeur Kadea Academy</p>
    </div>`,
  });
};

export const sendForgotPasswordEmail = async (user) => {
  const token = createToken(user.id, user.email, {
    expiresIn: "1d",
  });
  const verifyLink = `${serverRuntimeConfig.nextauthUrl
    }/auth/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: "Réinitialise ton mot de passe Kadea Sourcing",
    html: `<p>Tu as demandé un lien pour changer ton mot de passe. Tu peux le faire en cliquant sur le lien ci-dessous :<p>
    <p><a href="${verifyLink}" style="background-color: rgba(245, 59, 87); color:#fff; padding:8px; border: 2px solid red; margin: auto; border-radius: 15px;">Réinitialise ton mot de passe</a></p>
    <p>Le lien est valable pendant 24 heures. Si tu ne l'as pas demandé, ignore cet e-mail.</p>
    <p>Ton mot de passe ne changera pas tant que tu n'auras pas accédé au lien ci-dessus et créé un nouveau mot de passe.</p>
    <p>L'équipe Kadea</p>`,
  });
};

export const sendPasswordResetNotifyEmail = async (user) => {
  await sendEmail({
    to: user.email,
    subject: "Ton mot de passe Kadea Sourcing a été changé",
    html: `Nous te contactons pour t'informer que ton mot de passe a été modifié.<br/>
    <br/>
    L'équipe Kadea`,
  });
};

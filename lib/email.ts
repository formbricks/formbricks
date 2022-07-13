import jwt from "jsonwebtoken";
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
    secure: process.env.SMTP_SECURE_ENABLED || false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
  const emailDefaults = {
    from: process.env.MAIL_FROM || "noreply@snoopforms.com",
  };
  await transporter.sendMail({ ...emailDefaults, ...emailData });
};

export const sendVerificationEmail = async (user) => {
  const token = jwt.sign({ id: user.id }, process.env.SECRET + user.email, {
    expiresIn: "1d",
  });
  const verifyLink = `${
    process.env.NEXTAUTH_URL
  }/auth/verify?token=${encodeURIComponent(token)}`;
  const verificationRequestLink = `${
    process.env.NEXTAUTH_URL
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

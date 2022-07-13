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

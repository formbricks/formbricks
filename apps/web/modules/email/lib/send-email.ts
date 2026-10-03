import { createTransport } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { logger } from "@formbricks/logger";
import { InvalidInputError } from "@formbricks/types/errors";
import {
  DEBUG,
  IS_SMTP_CONFIGURED,
  MAIL_FROM,
  MAIL_FROM_NAME,
  SES_CONFIGURATION_SET,
  SES_EMAIL_ENVIRONMENT,
  SMTP_AUTHENTICATED,
  SMTP_HOST,
  SMTP_PASSWORD,
  SMTP_PORT,
  SMTP_REJECT_UNAUTHORIZED_TLS,
  SMTP_SECURE_ENABLED,
  SMTP_USER,
} from "@/lib/constants";

// Fixed categories keep CloudWatch cardinality independent of users and surveys.
export type TEmailType =
  | "invite"
  | "invite_accepted"
  | "email_verification"
  | "sso_recovery_verification"
  | "email_change_verification"
  | "password_reset"
  | "password_reset_notification"
  | "account_deletion"
  | "sso_recovery_notification"
  | "response_notification"
  | "survey_preview"
  | "customization_preview"
  | "verified_survey_link"
  | "survey_follow_up"
  | "workflow_email";

interface SendEmailDataProps {
  emailType: TEmailType;
  to: string;
  from?: string;
  replyTo?: string;
  subject: string;
  text?: string;
  html: string;
  /** Optional RFC 5322 Message-ID; nodemailer emits it as the `Message-ID` header. */
  messageId?: string;
}

export const sendEmail = async ({ emailType, ...emailData }: SendEmailDataProps): Promise<boolean> => {
  if (!IS_SMTP_CONFIGURED) {
    logger.info("SMTP is not configured, skipping email sending");
    return false;
  }
  try {
    const transporter = createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE_ENABLED,
      ...(SMTP_AUTHENTICATED
        ? {
            auth: {
              type: "LOGIN",
              user: SMTP_USER,
              pass: SMTP_PASSWORD,
            },
          }
        : {}),
      tls: {
        rejectUnauthorized: SMTP_REJECT_UNAUTHORIZED_TLS,
      },
      logger: DEBUG,
      debug: DEBUG,
    } as SMTPTransport.Options);

    const defaultFrom = `${MAIL_FROM_NAME ?? "Formbricks"} <${MAIL_FROM ?? "noreply@formbricks.com"}>`;
    await transporter.sendMail({
      ...emailData,
      from: emailData.from ?? defaultFrom,
      ...(SES_CONFIGURATION_SET && SES_EMAIL_ENVIRONMENT
        ? {
            headers: {
              "X-SES-CONFIGURATION-SET": SES_CONFIGURATION_SET,
              "X-SES-MESSAGE-TAGS": `email_type=${emailType}, environment=${SES_EMAIL_ENVIRONMENT}`,
            },
          }
        : {}),
    });

    return true;
  } catch (error) {
    logger.error(error, "Error in sendEmail");
    throw new InvalidInputError("Incorrect SMTP credentials");
  }
};

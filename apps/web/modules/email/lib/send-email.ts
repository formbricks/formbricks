import { createTransport } from "nodemailer";
import addressparser from "nodemailer/lib/addressparser";
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
import { type TEmailRateLimitContext, applyEmailRateLimits } from "./email-rate-limits";

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
  | "sso_sign_in_hint"
  | "data_retention_notice"
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
  /** Who the email is sent for; `emailRateLimits` says which fields each type needs. */
  rateLimit?: TEmailRateLimitContext;
}

const MAX_ADDRESS_LENGTH = 320;

/**
 * One plain address, read the way nodemailer will read it: no list, no group, no display name. Parsed rather
 * than matched against an address regex, so a valid internationalized address still gets through.
 */
const isSingleRecipient = (to: string): boolean => {
  // Bounded before parsing: some callers pass a visitor's input straight through.
  if (to.length > MAX_ADDRESS_LENGTH) return false;
  const parsed = addressparser(to);
  if (parsed.length !== 1) return false;
  const [entry] = parsed;
  if ("group" in entry || entry.name !== "" || entry.address !== to) return false;
  const at = to.indexOf("@");
  return at > 0 && at === to.lastIndexOf("@") && at < to.length - 1;
};

export const sendEmail = async ({
  emailType,
  rateLimit,
  ...emailData
}: SendEmailDataProps): Promise<boolean> => {
  // nodemailer reads `to` as an address list, so "a@x, b@y" would reach both. Every email goes to one
  // person, and every limit on email counts one recipient per send (ENG-6658).
  if (!isSingleRecipient(emailData.to)) {
    throw new InvalidInputError("An email must have exactly one valid recipient address");
  }
  if (!IS_SMTP_CONFIGURED) {
    logger.info("SMTP is not configured, skipping email sending");
    return false;
  }
  // Outside the try below, so a capped email reaches the caller as `TooManyRequestsError`, not as an SMTP
  // failure, and never opens a connection.
  await applyEmailRateLimits(emailType, emailData.to, rateLimit);
  try {
    const transportOptions: SMTPTransport.Options = {
      host: SMTP_HOST,
      port: Number.parseInt(SMTP_PORT ?? "", 10),
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
    };
    const transporter = createTransport(transportOptions);

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

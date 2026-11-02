import { createTransport } from "nodemailer";
import addressparser from "nodemailer/lib/addressparser";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { logger } from "@formbricks/logger";
import { InvalidInputError } from "@formbricks/types/errors";
import {
  DEBUG,
  EMAIL_SEND_AUDIT_ENABLED,
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
import { reportEmailAuditFailure } from "./email-audit-monitoring";
import { type TEmailRateLimitContext, applyEmailRateLimits } from "./email-rate-limits";
import { type TEmailAuditContext, beginEmailSendAudit, finishEmailSendAudit } from "./email-send-audit";

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
  | "account_deletion_notification"
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
  /** Audit identity and source, kept out of the SMTP payload. */
  auditContext: TEmailAuditContext;
}

const MAX_ADDRESS_LENGTH = 320;
const safeSmtpErrorCodes = new Set([
  "EAUTH",
  "ECONNECTION",
  "ECONNREFUSED",
  "EENVELOPE",
  "EMESSAGE",
  "ENOTFOUND",
  "ESOCKET",
  "ETIMEDOUT",
  "ETLS",
]);

const getSafeSmtpErrorCode = (error: unknown): string => {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return typeof code === "string" && safeSmtpErrorCodes.has(code) ? code : "unknown";
};

const getSesHeaders = (emailType: TEmailType) =>
  SES_CONFIGURATION_SET && SES_EMAIL_ENVIRONMENT
    ? {
        headers: {
          "X-SES-CONFIGURATION-SET": SES_CONFIGURATION_SET,
          "X-SES-MESSAGE-TAGS": `email_type=${emailType}, environment=${SES_EMAIL_ENVIRONMENT}`,
        },
      }
    : {};

const submitEmailToSmtp = async (
  emailData: Omit<SendEmailDataProps, "emailType" | "rateLimit" | "auditContext">,
  emailType: TEmailType
): Promise<unknown> => {
  const transportOptions: SMTPTransport.Options = {
    host: SMTP_HOST,
    port: Number.parseInt(SMTP_PORT ?? "", 10),
    secure: SMTP_SECURE_ENABLED,
    ...(SMTP_AUTHENTICATED ? { auth: { type: "LOGIN", user: SMTP_USER, pass: SMTP_PASSWORD } } : {}),
    tls: { rejectUnauthorized: SMTP_REJECT_UNAUTHORIZED_TLS },
    // SMTP debug output can include message content. Audited sends keep it out of ordinary logs.
    logger: DEBUG && !EMAIL_SEND_AUDIT_ENABLED,
    debug: DEBUG && !EMAIL_SEND_AUDIT_ENABLED,
  };
  const transporter = createTransport(transportOptions);
  const defaultFrom = `${MAIL_FROM_NAME ?? "Formbricks"} <${MAIL_FROM ?? "noreply@formbricks.com"}>`;
  return transporter.sendMail({
    ...emailData,
    from: emailData.from ?? defaultFrom,
    ...getSesHeaders(emailType),
  });
};

/**
 * One plain address, read the way nodemailer will read it: no list, no group, no display name, no angle
 * brackets. Parsed rather than matched against an address regex, so a valid internationalized address still
 * gets through, and the address is not compared to the input: the parser normalizes forms nodemailer still
 * delivers to that one inbox (a quoted local part, a trailing comma).
 */
const isSingleRecipient = (to: string): boolean => {
  // Bounded before parsing: some callers pass a visitor's input straight through.
  if (to.length > MAX_ADDRESS_LENGTH) return false;
  // A display-name wrapper is not a bare address, and nodemailer reads `<a@x>` as one.
  if (to.includes("<") || to.includes(">")) return false;
  // Exactly one `@` outside a quoted local part: `a@b@x.com` parses as a single address but is not one.
  let atSigns = 0;
  let quoted = false;
  for (let index = 0; index < to.length; index++) {
    const character = to[index];
    if (quoted && character === "\\") {
      index++;
      continue;
    }
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (character === "@" && !quoted) atSigns++;
  }
  if (quoted || atSigns !== 1) return false;

  const parsed = addressparser(to);
  if (parsed.length !== 1) return false;
  const [entry] = parsed;
  return !("group" in entry) && entry.name === "";
};

export const sendEmail = async ({
  emailType,
  rateLimit,
  auditContext,
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
  let auditState: Awaited<ReturnType<typeof beginEmailSendAudit>> = null;
  try {
    auditState = await beginEmailSendAudit(
      emailType,
      emailData.to,
      { subject: emailData.subject, html: emailData.html, text: emailData.text },
      auditContext
    );
  } catch {
    await reportEmailAuditFailure("email_audit_gap", { phase: "unhandled_begin" });
  }
  let sendInfo: unknown;
  try {
    sendInfo = await submitEmailToSmtp(emailData, emailType);
  } catch (error) {
    try {
      await finishEmailSendAudit(auditState, emailType, auditContext, "failed");
    } catch {
      await reportEmailAuditFailure("email_audit_gap", { phase: "unhandled_finish" });
    }
    logger.error(
      {
        emailType,
        event: "email_send_failed",
        errorCode: getSafeSmtpErrorCode(error),
      },
      "Error in sendEmail"
    );
    throw new InvalidInputError("Incorrect SMTP credentials");
  }
  try {
    await finishEmailSendAudit(auditState, emailType, auditContext, "accepted", sendInfo);
  } catch {
    await reportEmailAuditFailure("email_audit_gap", { phase: "unhandled_finish" });
  }
  return true;
};

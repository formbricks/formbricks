import "server-only";
import { createHash } from "node:crypto";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { type TUserLocale, ZUserLocale } from "@formbricks/types/user";
import { isLiteralEmailRecipient, renderWorkflowEmailBody } from "@formbricks/workflows";
import { normalizeEmailForComparison } from "@/lib/utils/email";
import {
  buildSurveyResponseEmailHtml,
  resolveResponseRecipient,
} from "@/modules/email/lib/survey-response-email";
import type { WorkflowStepExecutor, WorkflowStepOutcome } from "./types";

/** Strips CR/LF and other control chars from the subject — defense against SMTP header injection. */
const CONTROL_CHARS_PATTERN = /[\x00-\x1f\x7f\u2028\u2029]/g;
const stripControlChars = (value: string): string => value.replace(CONTROL_CHARS_PATTERN, "");

/** Coerces a response's free-form `language` to a supported locale, falling back to undefined (→ default). */
const toResponseLocale = (language: string | null): TUserLocale | undefined => {
  const parsed = ZUserLocale.safeParse(language);
  if (!parsed.success) return undefined;
  return parsed.data;
};

const EMAIL_PROVIDER = "smtp";
const MESSAGE_ID_FALLBACK_DOMAIN = "formbricks.com";

/** Extracts the domain from a validated email address, falling back to a stable default. */
const domainFromEmail = (from: string): string => from.split("@")[1]?.trim() || MESSAGE_ID_FALLBACK_DOMAIN;

/**
 * Builds the deterministic RFC 5322 Message-ID (`<hash@domain>`) stored on a step output and sent as
 * the `Message-ID` header. Stable across retries for the same run + step, so a replayed send carries
 * the same id — enabling protocol-level dedup and traceability to the same logical message.
 *
 * Sized to 128 bits (32 hex chars) — the conventional scale for uniqueness ids (a UUID is 122).
 * The id only needs to be unique, never preimage-resistant, so the full 256-bit digest bought
 * nothing while pushing the header past the RFC 5322 78-char soft limit, forcing nodemailer to
 * fold it; folded headers are valid MIME but trip naive parsers (MailHog shows the folded id as
 * part of the Subject).
 */
const buildMessageId = (workflowRunId: string, stepId: string, from: string): string => {
  const hash = createHash("sha256").update(`${workflowRunId}:${stepId}`).digest("hex").slice(0, 32);
  return `<${hash}@${domainFromEmail(from)}>`;
};

const failed = (error: string): WorkflowStepOutcome => ({ status: "failed", error, output: {} });

/**
 * Resolves and sends one `send_email` step, Follow-Ups parity: resolves the recipient from the
 * response (literal email or question/hidden-field id), renders the branded HTML via
 * `buildSurveyResponseEmailHtml` (recall body + optional response-data blocks), and sends HTML-only.
 * Variable-path recall tokens in the body (`steps.…`) are inserted HTML-escaped first; bare and
 * `response.` tokens are left to survey recall. The subject is sanitized (control chars stripped)
 * and a stable RFC `Message-ID` is recorded on both the sent header and the step output.
 */
export const sendEmailStepExecutor: WorkflowStepExecutor<"send_email"> = {
  hasEffects: true,
  describeInput: (node) => ({ to: node.config.to, subject: node.config.subject }),
  execute: async ({ node, context, environment, effects }) => {
    const { config } = node;
    // ENG-7180 adds a recipient from the payload; until then an email renders against a response.
    if (!environment.surveyResponse) {
      return failed("Send email needs the survey response of a Response completed trigger");
    }
    const { survey, response } = environment.surveyResponse;

    const recipient = resolveResponseRecipient(config.to, response);
    if (!recipient.ok) return failed(recipient.error);

    // Recipient allowlist (ENG-2029): a literal `to` address may only belong to someone who can access
    // this workspace, so a live workflow can't silently forward response data to an arbitrary external
    // inbox. A respondent-field `to` resolves to the respondent's own address and is always allowed.
    // This is the send-time backstop to the enable-time check — it also covers access lost after
    // enable (ENG-2186).
    if (
      isLiteralEmailRecipient(config.to) &&
      !environment.allowedRecipientEmails.has(normalizeEmailForComparison(recipient.email))
    ) {
      return failed(`Recipient ${recipient.email} cannot access this workspace`);
    }

    const messageId = buildMessageId(environment.runId, node.id, config.from);
    const subject = stripControlChars(config.subject);

    try {
      const html = await buildSurveyResponseEmailHtml({
        body: renderWorkflowEmailBody(config.body, context),
        survey,
        response,
        attachResponseData: config.attachResponseData,
        includeVariables: config.includeVariables,
        includeHiddenFields: config.includeHiddenFields,
        logoUrl: environment.logoUrl,
        locale: toResponseLocale(response.language),
      });

      // No `from` — the deployment MAIL_FROM default applies, exactly like survey Follow-Ups.
      // `config.from` is only used to derive the stable Message-ID domain, never as the actual sender.
      const sent = await effects.sendEmail({
        emailType: "workflow_email",
        auditContext: {
          trigger: "workflow",
          organizationId: environment.rateLimit.organizationId,
          surveyId: survey.id,
          responseId: response.id,
          workflowRunId: environment.runId,
          workflowId: environment.workflowId,
          configuredByUserId: environment.configuredByUserId,
        },
        to: recipient.email,
        replyTo: config.replyTo.length > 0 ? config.replyTo.join(", ") : undefined,
        subject,
        html,
        messageId,
        // A literal address is a workspace member (the allowlist above); a respondent-field one is external.
        rateLimit: { ...environment.rateLimit, externalRecipient: !isLiteralEmailRecipient(config.to) },
      });

      if (sent) {
        return { status: "succeeded", error: null, output: { messageId, provider: EMAIL_PROVIDER } };
      }
      return failed("SMTP is not configured; workflow email was not sent");
    } catch (sendError) {
      // A spent email cap is not a send failure: nothing reached SMTP, and the run history and failure
      // analytics should say "throttled", not "broken". Recorded as skipped, which a later attempt retries.
      if (sendError instanceof TooManyRequestsError) {
        return { status: "skipped", error: null, output: { reason: "email_rate_limited" } };
      }
      return failed(sendError instanceof Error ? sendError.message : "Failed to send workflow email");
    }
  },
};

import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { type TUserLocale, ZUserLocale } from "@formbricks/types/user";
import {
  type TWorkflowRunContext,
  type TWorkflowSendEmailActionConfig,
  buildWorkflowSurveyLink,
  getIncludeEmbeddedData,
  insertWorkflowSurveyLink,
  isLiteralEmailRecipient,
  isVariableEmailRecipient,
  renderWorkflowEmailBody,
  resolveWorkflowVariable,
} from "@formbricks/workflows";
import { normalizeEmailForComparison } from "@/lib/utils/email";
import {
  buildSurveyResponseEmailHtml,
  buildWorkflowEmailHtml,
  resolveResponseRecipient,
} from "@/modules/email/lib/survey-response-email";
import type { WorkflowRunEnvironment } from "../run-environment";
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

const failed = (error: string, output: Record<string, unknown> = {}): WorkflowStepOutcome => ({
  status: "failed",
  error,
  output,
});

/** A failure another attempt can't fix: the run fails at once, without a retry (ENG-7169). */
const failedForGood = (error: string, output: Record<string, unknown> = {}): WorkflowStepOutcome => ({
  ...failed(error, output),
  retryable: false,
});

const ZEmailAddress = z.email();

type TResolvedRecipient =
  | {
      ok: true;
      email: string;
      /** Read from a Variable: not allowlisted, counted per workflow, and every failure is final. */
      fromVariable: boolean;
      /** Outside the organization: counted against the caps respondents and callers can drive. */
      external: boolean;
    }
  | { ok: false; outcome: WorkflowStepOutcome };

/**
 * Who the email goes to: an address read from a Variable (ENG-7169), a literal address, or a survey
 * question / hidden field of the run's response. A Variable's address is never allowlist-checked, so
 * the step's body is fixed (enforced on Enable); an empty or invalid one fails the step for good.
 */
const resolveRecipient = (
  to: TWorkflowSendEmailActionConfig["to"],
  context: TWorkflowRunContext,
  environment: WorkflowRunEnvironment
): TResolvedRecipient => {
  if (isVariableEmailRecipient(to)) {
    const resolved = resolveWorkflowVariable(context, to.ref);
    const value = resolved.found && typeof resolved.value === "string" ? resolved.value.trim() : "";
    if (value === "") {
      return { ok: false, outcome: failedForGood(`Recipient ${to.ref} is empty in this run`) };
    }
    // The bad value is left out of the reason: it is caller-supplied text, possibly someone's data.
    if (!ZEmailAddress.safeParse(value).success) {
      return { ok: false, outcome: failedForGood(`Recipient ${to.ref} is not a valid email address`) };
    }
    return { ok: true, email: value, fromVariable: true, external: true };
  }

  if (isLiteralEmailRecipient(to)) {
    // Recipient allowlist (ENG-2029): a literal `to` address may only belong to someone who can access
    // this workspace, so a live workflow can't silently forward response data to an arbitrary external
    // inbox. This is the send-time backstop to the enable-time check — it also covers access lost after
    // enable (ENG-2186).
    if (!environment.allowedRecipientEmails.has(normalizeEmailForComparison(to))) {
      return { ok: false, outcome: failed(`Recipient ${to} cannot access this workspace`) };
    }
    return { ok: true, email: to, fromVariable: false, external: false };
  }

  // A survey question / hidden field resolves to the respondent's own address and is always allowed.
  if (!environment.surveyResponse) {
    return {
      ok: false,
      outcome: failed(
        "A survey question recipient needs the survey response of a Response completed trigger"
      ),
    };
  }
  const recipient = resolveResponseRecipient(to, environment.surveyResponse.response);
  if (!recipient.ok) return { ok: false, outcome: failed(recipient.error) };
  return { ok: true, email: recipient.email, fromVariable: false, external: true };
};

type TResolvedSurveyLink = { ok: true; url: string | null } | { ok: false; outcome: WorkflowStepOutcome };

/** The link the email carries (ENG-7117 D2), or `null` when the step links no survey. */
const resolveSurveyLink = (
  surveyLink: TWorkflowSendEmailActionConfig["surveyLink"],
  context: TWorkflowRunContext,
  environment: WorkflowRunEnvironment
): TResolvedSurveyLink => {
  if (!surveyLink) return { ok: true, url: null };
  const check = environment.surveyLinkSurveys.get(surveyLink.surveyId);
  if (check?.status !== "ok") {
    return {
      ok: false,
      outcome: failedForGood(`Survey ${surveyLink.surveyId} is not a link survey in this workspace`),
    };
  }
  return {
    ok: true,
    url: buildWorkflowSurveyLink({
      publicDomain: environment.publicDomain,
      surveyId: surveyLink.surveyId,
      embeddedData: surveyLink.embeddedData,
      acceptedKeys: check.acceptedEmbeddedDataKeys,
      context,
    }),
  };
};

/** The email's HTML: rendered against the run's response when it has one, else as a fixed email. */
const renderEmailHtml = async (
  config: TWorkflowSendEmailActionConfig,
  context: TWorkflowRunContext,
  environment: WorkflowRunEnvironment,
  surveyLinkUrl: string | null
): Promise<string> => {
  // Variables go in first (HTML-escaped), then the survey link, whose URL encoding keeps any `#` in
  // an inserted value from reading as a recall token afterwards.
  const renderedBody = renderWorkflowEmailBody(config.body, context);
  const body = surveyLinkUrl ? insertWorkflowSurveyLink(renderedBody, surveyLinkUrl) : renderedBody;

  if (!environment.surveyResponse) {
    return buildWorkflowEmailHtml({ body, logoUrl: environment.logoUrl });
  }
  const { survey, response } = environment.surveyResponse;
  return buildSurveyResponseEmailHtml({
    body,
    survey,
    response,
    attachResponseData: config.attachResponseData,
    includeVariables: getIncludeEmbeddedData(config),
    includeHiddenFields: config.includeHiddenFields,
    logoUrl: environment.logoUrl,
    locale: toResponseLocale(response.language),
  });
};

/**
 * Resolves and sends one `send_email` step, Follow-Ups parity: resolves the recipient (a Variable, a
 * literal email, or a question/hidden-field id of the response), places the survey link, renders the
 * branded HTML (recall body + optional response-data blocks, or the fixed body of a run without a
 * response), and sends HTML-only through the effects port. The subject is sanitized (control chars
 * stripped) and a stable RFC `Message-ID` is recorded on both the sent header and the step output,
 * with the recipient and the survey link sent, so run detail shows who got what (ENG-7117).
 */
export const sendEmailStepExecutor: WorkflowStepExecutor<"send_email"> = {
  hasEffects: true,
  describeInput: (node) => ({ to: node.config.to, subject: node.config.subject }),
  execute: async ({ node, context, environment, effects }) => {
    const { config } = node;

    const recipient = resolveRecipient(config.to, context, environment);
    if (!recipient.ok) return recipient.outcome;

    const surveyLink = resolveSurveyLink(config.surveyLink, context, environment);
    if (!surveyLink.ok) return surveyLink.outcome;

    const sentTo = {
      recipient: recipient.email,
      ...(surveyLink.url ? { surveyLink: surveyLink.url } : {}),
    };
    const messageId = buildMessageId(environment.runId, node.id, config.from);
    const subject = stripControlChars(config.subject);

    try {
      const html = await renderEmailHtml(config, context, environment, surveyLink.url);

      // No `from` — the deployment MAIL_FROM default applies, exactly like survey Follow-Ups.
      // `config.from` is only used to derive the stable Message-ID domain, never as the actual sender.
      const sent = await effects.sendEmail({
        emailType: "workflow_email",
        auditContext: {
          trigger: "workflow",
          organizationId: environment.rateLimit.organizationId,
          surveyId: environment.surveyResponse?.survey.id,
          responseId: environment.surveyResponse?.response.id,
          workflowRunId: environment.runId,
          workflowId: environment.workflowId,
          configuredByUserId: environment.configuredByUserId,
        },
        to: recipient.email,
        replyTo: config.replyTo.length > 0 ? config.replyTo.join(", ") : undefined,
        subject,
        html,
        messageId,
        rateLimit: {
          ...environment.rateLimit,
          externalRecipient: recipient.external,
          // An address from a Variable is also capped per workflow (50 an hour), so one leaked Webhook
          // Secret URL can't spend the organization's whole budget.
          ...(recipient.fromVariable ? { workflowId: environment.workflowId } : {}),
        },
      });

      if (sent) {
        return {
          status: "succeeded",
          error: null,
          output: { messageId, provider: EMAIL_PROVIDER, ...sentTo },
        };
      }
      return failed("SMTP is not configured; workflow email was not sent");
    } catch (sendError) {
      if (sendError instanceof TooManyRequestsError) {
        // An address from a Variable fails the step and the run, with the reason in run detail
        // (ENG-7169): retrying would only let a caller queue more email behind the cap.
        if (recipient.fromVariable) {
          return failedForGood("Email rate limit reached; this workflow email was not sent", sentTo);
        }
        // Otherwise a spent cap is not a send failure: nothing reached SMTP, and the run history and
        // failure analytics should say "throttled", not "broken". Recorded as skipped, which a later
        // attempt retries.
        return { status: "skipped", error: null, output: { reason: "email_rate_limited" } };
      }
      return failed(sendError instanceof Error ? sendError.message : "Failed to send workflow email");
    }
  },
};

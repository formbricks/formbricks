import type { TWorkflowSendEmailActionConfig } from "../types/actions/send-email";
import type { TWorkflowTriggerRunPayload } from "../types/runs";
import { escapeHtml, isValidEmail, stripControlChars } from "./escape";
import { resolvePlaceholders } from "./templating";

/** A fully resolved email ready to hand to the host app's `sendEmail`. No I/O happens here. */
export interface TResolvedWorkflowEmail {
  to: string;
  from: string;
  replyTo: string[];
  subject: string;
  /** HTML body; every interpolated, respondent-controlled value is HTML-escaped. */
  html: string;
  /** Plain-text alternative; raw values, no escaping. */
  text: string;
  /** Whether the resolved `to` is a valid single email address. The caller must not send when false. */
  recipientValid: boolean;
}

const RESPONSE_DATA_KEY = "response";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

interface ResponseDataLine {
  key: string;
  value: string;
}

/**
 * Collects the appended "response data" lines when `attachResponseData` is on. Pulls the
 * `response.*` map from the run trigger payload as raw `key: value` pairs. `includeVariables` and
 * `includeHiddenFields` gate the `variables`/`hiddenFields` sub-maps; everything else is always
 * included. Returns the raw lines so the caller can render escaped (html) and unescaped (text) views.
 */
const collectResponseDataLines = (
  config: TWorkflowSendEmailActionConfig,
  triggerPayload: TWorkflowTriggerRunPayload
): ResponseDataLine[] => {
  const data: Record<string, unknown> = triggerPayload.data ?? {};
  const responseValue = data[RESPONSE_DATA_KEY];
  const response: Record<string, unknown> = isRecord(responseValue) ? responseValue : {};

  const gatedKeys = new Set<string>();
  if (!config.includeVariables) {
    gatedKeys.add("variables");
  }
  if (!config.includeHiddenFields) {
    gatedKeys.add("hiddenFields");
  }

  const lines: ResponseDataLine[] = [];
  for (const [key, value] of Object.entries(response)) {
    if (gatedKeys.has(key)) {
      continue;
    }
    const rendered = isRecord(value) || Array.isArray(value) ? JSON.stringify(value) : String(value);
    lines.push({ key, value: rendered });
  }

  return lines;
};

/**
 * Resolves a `send_email` action config into a concrete email against the run's trigger payload:
 * placeholders in `to`/`subject`/`body` are filled (missing paths → empty string), and when
 * `attachResponseData` is enabled the response data is appended. Two bodies are produced: `html`,
 * where every respondent-controlled interpolated value (and the appended response-data block) is
 * HTML-escaped, and a raw `text` alternative. The resolved recipient is validated. Pure and
 * unit-testable; the caller performs the actual send (and must skip it when `recipientValid` is false).
 */
export const resolveWorkflowEmail = (
  config: TWorkflowSendEmailActionConfig,
  triggerPayload: TWorkflowTriggerRunPayload
): TResolvedWorkflowEmail => {
  // Strip control chars (CR/LF, etc.) from the resolved subject — defense-in-depth against header
  // injection via respondent-controlled placeholder values.
  const subject = stripControlChars(resolvePlaceholders(config.subject, triggerPayload));
  const to = resolvePlaceholders(config.to, triggerPayload);

  // Author-controlled template structure stays intact; only the interpolated dynamic values are escaped for html.
  let html = resolvePlaceholders(config.body, triggerPayload, { transform: escapeHtml });
  let text = resolvePlaceholders(config.body, triggerPayload);

  if (config.attachResponseData) {
    const lines = collectResponseDataLines(config, triggerPayload);
    if (lines.length > 0) {
      html += `\n\n${lines.map((line) => `${escapeHtml(line.key)}: ${escapeHtml(line.value)}`).join("\n")}`;
      text += `\n\n${lines.map((line) => `${line.key}: ${line.value}`).join("\n")}`;
    }
  }

  return {
    to,
    from: config.from,
    replyTo: config.replyTo,
    subject,
    html,
    text,
    recipientValid: isValidEmail(to),
  };
};

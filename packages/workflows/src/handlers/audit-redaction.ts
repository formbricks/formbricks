import { createHash, createHmac } from "node:crypto";
import { WORKFLOW_ACTIONS } from "../types/actions";

/**
 * `send_email` action config fields that can carry literal PII (recipient/sender addresses and
 * message content). The non-PII fields (`attachResponseData`, `includeVariables`,
 * `includeHiddenFields`) are intentionally left intact so a real config change still surfaces in
 * the audit diff. Mirrors `ZWorkflowSendEmailActionConfig` in `types/actions/send-email.ts`.
 */
const SEND_EMAIL_PII_FIELDS = ["to", "from", "replyTo", "subject", "body"] as const;

/**
 * Replace a PII value with a value-stable, non-reversible marker: `"[redacted:<digest>]"` where
 * `<digest>` is the first 12 hex chars of a keyed HMAC-SHA256 (or, if no key is injected, a plain
 * SHA256 fallback for non-EE/local). Same value+key → same marker (an unchanged recipient produces
 * no spurious diff); different value → different marker (a real change still surfaces in `changes`).
 *
 * The key matters: a plain `sha256` of a low-entropy value like an email is offline-guessable —
 * anyone with audit-log read access could confirm a likely recipient by hashing candidates. An
 * HMAC keyed with the app's audit secret keeps the marker stable yet not trivially reversible
 * without the secret. The key is injected (never read from env here) so the package stays
 * framework-agnostic.
 */
const redactValue = (value: string, key?: string): string => {
  const digest = key
    ? createHmac("sha256", key).update(value).digest("hex")
    : createHash("sha256").update(value).digest("hex");
  return `[redacted:${digest.slice(0, 12)}]`;
};

/** Redact one PII field: hash each element of an array (e.g. `replyTo`), otherwise hash the value. */
const redactField = (value: unknown, key?: string): unknown => {
  if (Array.isArray(value)) {
    return value.map((element) => redactValue(String(element), key));
  }
  return redactValue(String(value), key);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * `http_request` headers in an audit snapshot (ENG-7168): a secret header keeps only its name and
 * whether it is set — whatever shape reached here, its value and stored id never do — and a plain
 * header's value becomes a marker, since an author may keep a credential in a header they unlocked.
 * The URL, method and names stay readable: "changing the URL is recorded in the audit log" (ADR 0042).
 */
const redactHttpRequestConfig = (config: Record<string, unknown>, key?: string): Record<string, unknown> => {
  if (!Array.isArray(config.headers)) return config;
  const headers: unknown[] = config.headers;
  return {
    ...config,
    headers: headers.map((header): unknown => {
      if (!isRecord(header)) return header;
      if (header.secret === true) {
        return { name: header.name, secret: true, isSet: Boolean(header.secretId ?? header.isSet) };
      }
      return "value" in header ? { ...header, value: redactField(header.value, key) } : header;
    }),
  };
};

/**
 * A survey link's Embedded Data values can be literal text (a name, an id), so they are masked like
 * the subject; the survey id and the keys are configuration and stay readable.
 */
const redactSurveyLink = (surveyLink: unknown, key?: string): unknown => {
  if (!isRecord(surveyLink) || !Array.isArray(surveyLink.embeddedData)) return surveyLink;
  const embeddedData: unknown[] = surveyLink.embeddedData;
  return {
    ...surveyLink,
    embeddedData: embeddedData.map((entry) =>
      isRecord(entry) && "value" in entry ? { ...entry, value: redactField(entry.value, key) } : entry
    ),
  };
};

/**
 * Redact PII from a workflow definition's actions before the snapshot leaves this package for the
 * audit log. The shared `redactPII` keys off field NAMES (`email`, `token`, …) and does not match
 * the workflow definition's `to`/`from`/`replyTo`/`subject`/`body`, so without this the values
 * would reach the audit `changes` verbatim. Done here (domain knowledge about the definition shape)
 * rather than by widening the global sensitive-key list, which would over-redact unrelated events.
 *
 * `key` is the optional HMAC secret the adapter injects (the app's audit secret); see `redactValue`.
 *
 * Returns a deep-copied definition with the `send_email` PII fields replaced by value-stable
 * markers; everything else (status, name, structure, non-PII config) is preserved so the diff stays
 * readable, and a changed recipient still produces a (content-free) diff entry.
 */
export const redactWorkflowDefinitionPII = (definition: unknown, key?: string): unknown => {
  if (!isRecord(definition)) return definition;
  if (!Array.isArray(definition.nodes)) return definition;

  const nodes: unknown[] = definition.nodes;
  const redactedNodes = nodes.map((node): unknown => {
    if (isRecord(node) && node.actionType === WORKFLOW_ACTIONS.HTTP_REQUEST && isRecord(node.config)) {
      return { ...node, config: redactHttpRequestConfig(node.config, key) };
    }
    if (
      !isRecord(node) ||
      node.type !== "action" ||
      node.actionType !== WORKFLOW_ACTIONS.SEND_EMAIL ||
      !isRecord(node.config)
    ) {
      return node;
    }

    const redactedConfig: Record<string, unknown> = { ...node.config };
    for (const field of SEND_EMAIL_PII_FIELDS) {
      // A Variable recipient (`{type: "variable", ref}`) holds a path, not an address: kept readable.
      if (field in redactedConfig && !isRecord(redactedConfig[field])) {
        redactedConfig[field] = redactField(redactedConfig[field], key);
      }
    }
    redactedConfig.surveyLink = redactSurveyLink(redactedConfig.surveyLink, key);
    if (redactedConfig.surveyLink === undefined) delete redactedConfig.surveyLink;
    return { ...node, config: redactedConfig };
  });

  return { ...definition, nodes: redactedNodes };
};

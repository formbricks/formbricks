import { createHash } from "node:crypto";
import { WORKFLOW_ACTIONS } from "../types/actions";

/**
 * `send_email` action config fields that can carry literal PII (recipient/sender addresses and
 * message content). The non-PII fields (`attachResponseData`, `includeVariables`,
 * `includeHiddenFields`) are intentionally left intact so a real config change still surfaces in
 * the audit diff. Mirrors `ZWorkflowSendEmailActionConfig` in `types/actions/send-email.ts`.
 */
const SEND_EMAIL_PII_FIELDS = ["to", "from", "replyTo", "subject", "body"] as const;

/**
 * Replace a PII value with a value-stable, non-reversible marker: `"[redacted:<hash>]"` where the
 * hash is the first 12 hex chars of `sha256(String(value))`. Same input → same marker (an unchanged
 * recipient produces no spurious diff), different input → different marker (a real change still
 * surfaces in `changes`), and the raw value is never recoverable from the marker. A constant token
 * would collapse `deepDiff` (token == token) and hide recipient-only edits — hence the per-value hash.
 */
const redactValue = (value: string): string =>
  `[redacted:${createHash("sha256").update(value).digest("hex").slice(0, 12)}]`;

/** Redact one PII field: hash each element of an array (e.g. `replyTo`), otherwise hash the value. */
const redactField = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((element) => redactValue(String(element)));
  }
  return redactValue(String(value));
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Redact PII from a workflow definition's actions before the snapshot leaves this package for the
 * audit log. The shared `redactPII` keys off field NAMES (`email`, `token`, …) and does not match
 * the workflow definition's `to`/`from`/`replyTo`/`subject`/`body`, so without this the values
 * would reach the audit `changes` verbatim. Done here (domain knowledge about the definition shape)
 * rather than by widening the global sensitive-key list, which would over-redact unrelated events.
 *
 * Returns a deep-copied definition with the `send_email` PII fields replaced by value-stable
 * markers; everything else (status, name, structure, non-PII config) is preserved so the diff stays
 * readable, and a changed recipient still produces a (content-free) diff entry.
 */
export const redactWorkflowDefinitionPII = (definition: unknown): unknown => {
  if (!isRecord(definition)) return definition;
  if (!Array.isArray(definition.nodes)) return definition;

  const nodes: unknown[] = definition.nodes;
  const redactedNodes = nodes.map((node): unknown => {
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
      if (field in redactedConfig) {
        redactedConfig[field] = redactField(redactedConfig[field]);
      }
    }
    return { ...node, config: redactedConfig };
  });

  return { ...definition, nodes: redactedNodes };
};

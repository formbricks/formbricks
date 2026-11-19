import type { AuthInfo, CallToolResult } from "@modelcontextprotocol/server";
import type { TMcpPermissionRequirement } from "../permissions";
import { mcpCallerHolds } from "./caller-permissions";

/**
 * Tools that return some data only to a caller who may read it (a survey's targeting, a workflow run's
 * respondent-derived fields, a response's contact `userId`) share one way to rebuild their result: each
 * entry of `data` (one resource, or a list) goes through a redaction, and the text content is rewritten
 * from the redacted payload, so the two never disagree. Over MCP only; the REST operations are unchanged.
 */

/** A plain object: not `null`, not an array. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * `result` with each entry of its `data` (the resource, or each item of a list) passed through `redact`.
 * An error result, one without `data`, or one `redact` leaves as it was (returning the same entries) is
 * handed back unchanged rather than re-serialized.
 */
export const redactToolResultData = (
  result: CallToolResult,
  redact: (entry: unknown) => unknown
): CallToolResult => {
  const payload = result.structuredContent;
  if (result.isError || !isRecord(payload) || !("data" in payload)) return result;
  const source: unknown = payload.data;
  let data: unknown;
  let changed: boolean;
  if (Array.isArray(source)) {
    const entries: unknown[] = source.map(redact);
    data = entries;
    changed = entries.some((entry, index) => entry !== source[index]);
  } else {
    data = redact(source);
    changed = data !== source;
  }
  if (!changed) return result;
  const redacted = { ...payload, data };
  return {
    ...result,
    structuredContent: redacted,
    content: [{ type: "text", text: JSON.stringify(redacted) }],
  };
};

/**
 * `result` as `authInfo` may read it: unchanged for a caller holding every one of `requirements` (by the
 * token's scope and the grant, as `mcpCallerHolds` reads them), and redacted entry by entry otherwise.
 */
export const redactUnlessCallerHolds = (
  authInfo: AuthInfo | undefined,
  requirements: readonly TMcpPermissionRequirement[],
  result: CallToolResult,
  redact: (entry: unknown) => unknown
): CallToolResult =>
  requirements.every((requirement) => mcpCallerHolds(authInfo, requirement))
    ? result
    : redactToolResultData(result, redact);

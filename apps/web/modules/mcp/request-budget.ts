/** Shared by the HTTP request preflight and the SDK's per-tool validation guard. */
export const MCP_REQUEST_MAX_ELEMENTS = 50_000;
const MCP_REQUEST_MAX_DEPTH = 256;

/**
 * Bound validation work across the whole HTTP request, including legacy batches. The SDK's
 * maxToolInputElements applies separately to each call, so a batch can multiply that allowance.
 * Count object members and array entries before any schema runs; walk iteratively so deeply
 * nested JSON cannot exhaust the call stack. The byte limit is enforced before JSON.parse.
 */
export function getMcpRequestBudgetError(value: unknown): string | null {
  const pending = [{ value, depth: 1 }];
  let elements = 0;

  while (pending.length > 0) {
    const current = pending.pop()!;
    if (typeof current.value !== "object" || current.value === null) continue;
    if (current.depth > MCP_REQUEST_MAX_DEPTH) {
      return `Request must not nest more than ${MCP_REQUEST_MAX_DEPTH} levels`;
    }

    const container = current.value;
    const count = Array.isArray(container) ? container.length : Object.keys(container).length;
    elements += count;
    if (elements > MCP_REQUEST_MAX_ELEMENTS) {
      return `Request must not contain more than ${MCP_REQUEST_MAX_ELEMENTS} object members and array elements`;
    }

    for (const child of Array.isArray(container) ? container : Object.values(container)) {
      if (typeof child === "object" && child !== null) {
        pending.push({ value: child, depth: current.depth + 1 });
      }
    }
  }

  return null;
}

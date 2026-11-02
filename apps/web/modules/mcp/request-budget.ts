/** Allow large survey documents while bounding schema-validation work (ENG-4099). */
export const MCP_REQUEST_MAX_ELEMENTS = 50_000;

/**
 * Count object members as well as array entries across the whole request, including legacy batches
 * and protocol metadata. The shared array budget already limits array length and nesting; it does
 * not count object members. The SDK's limit applies separately to each tool call, so it cannot bound
 * a batch on its own. This walk runs on JSON parsed under the route's existing byte limit.
 */
export function getMcpRequestBudgetError(value: unknown): string | null {
  const pending: unknown[] = [value];
  let elements = 0;

  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current !== "object" || current === null) continue;

    elements += Array.isArray(current) ? current.length : Object.keys(current).length;
    if (elements > MCP_REQUEST_MAX_ELEMENTS) {
      return `Request must not contain more than ${MCP_REQUEST_MAX_ELEMENTS} object members and array elements. Reduce tool arguments or split batches into smaller requests.`;
    }

    for (const child of Array.isArray(current) ? current : Object.values(current)) {
      if (typeof child === "object" && child !== null) pending.push(child);
    }
  }

  return null;
}

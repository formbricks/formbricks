/**
 * The slice of an MCP `CallToolResult` the views read. Declared here instead of imported so the views do
 * not depend on the SDK's type packages, which `@modelcontextprotocol/ext-apps` only lists as peers.
 */
export interface ToolContentBlock {
  type: string;
  text?: string;
}

export interface ToolResult {
  content?: ToolContentBlock[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

/** The first text block, which every Formbricks tool fills with a short human-readable summary. */
export const getResultText = (result: ToolResult | null | undefined): string | undefined =>
  result?.content?.find((block) => block.type === "text")?.text;

/**
 * What went wrong, when the call failed. A tool can fail two ways: a protocol-level `isError` result,
 * or the error branch of its structured output (`mcpToolOutput` in apps/web describes it). Both read
 * as a message the view can show next to a retry, never as a thrown error.
 */
export const getToolError = (result: ToolResult | null | undefined): string | undefined => {
  if (!result) return undefined;
  const structured = result.structuredContent;
  const detail =
    structured &&
    typeof structured === "object" &&
    "detail" in structured &&
    typeof structured.detail === "string"
      ? structured.detail
      : undefined;
  if (result.isError) {
    return detail ?? getResultText(result) ?? "The request failed.";
  }
  return undefined;
};

/** Narrow `structuredContent` to the shape a view expects, or `undefined` when it does not fit. */
export const readStructured = <T>(
  result: ToolResult | null | undefined,
  isShape: (value: unknown) => value is T
): T | undefined => {
  const structured = result?.structuredContent;
  return isShape(structured) ? structured : undefined;
};

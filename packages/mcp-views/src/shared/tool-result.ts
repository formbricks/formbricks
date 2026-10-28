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
 * What went wrong, when the call failed. A failed Formbricks tool answers `isError` with the problem in
 * `structuredContent.error` (`{status, title, detail, requestId, code?, invalid_params?}`, the error
 * branch `mcpToolOutput` describes in apps/web). It reads as a message the view can show next to a
 * retry, never as a thrown error.
 */
export interface ToolFailure {
  status?: number;
  title?: string;
  detail: string;
  code?: string;
}

export const getToolFailure = (result: ToolResult | null | undefined): ToolFailure | undefined => {
  if (!result) return undefined;
  const error = result.structuredContent?.error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const detail = typeof record.detail === "string" ? record.detail : undefined;
    const title = typeof record.title === "string" ? record.title : undefined;
    return {
      status: typeof record.status === "number" ? record.status : undefined,
      title,
      detail: detail ?? title ?? getResultText(result) ?? "The request failed.",
      code: typeof record.code === "string" ? record.code : undefined,
    };
  }
  if (result.isError) {
    return { detail: getResultText(result) ?? "The request failed." };
  }
  return undefined;
};

/** The failure as a single sentence, for views that only need to show it. */
export const getToolError = (result: ToolResult | null | undefined): string | undefined =>
  getToolFailure(result)?.detail;

/** Narrow `structuredContent` to the shape a view expects, or `undefined` when it does not fit. */
export const readStructured = <T>(
  result: ToolResult | null | undefined,
  isShape: (value: unknown) => value is T
): T | undefined => {
  const structured = result?.structuredContent;
  return isShape(structured) ? structured : undefined;
};

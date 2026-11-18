import type { CallToolResult } from "@modelcontextprotocol/server";

/** A successful tool result carrying `payload`, as `responseToMcpToolResult` builds one. For tests. */
export const toolResult = (payload: unknown): CallToolResult => ({
  structuredContent: payload,
  content: [{ type: "text", text: JSON.stringify(payload) }],
});

/** The parsed JSON of a result's first text content. For tests. */
export const toolResultText = (result: CallToolResult): unknown => {
  const [first] = result.content;
  if (first?.type !== "text") throw new Error("the result has no text content");
  return JSON.parse(first.text);
};

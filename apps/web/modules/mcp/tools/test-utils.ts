import { type AuthInfo, McpServer, createMcpHandler } from "@modelcontextprotocol/server";

/** The slice of a `tools/call` JSON-RPC response the tool tests assert on. */
export type ToolCallOutcome = {
  error?: { code: number; message: string };
  result?: { isError?: boolean; content?: { type: string; text?: string }[] };
};

export type ToolCallEra = "modern" | "legacy";

/**
 * Sends one `tools/call` through a real `McpServer` behind the real HTTP handler, so the SDK's own
 * `validateToolInput` runs — calling a registered handler directly skips it. This is the one place
 * the tool tests build that request, so an SDK bump that changes the wire format is updated once.
 *
 * `era` picks which protocol leg serves the call. Both are exercised because the one endpoint answers
 * both (`mcp-handler` serves with `legacy: "stateless"`), and validation must not differ between them.
 * A 2026-07-28 request carries the `Mcp-Method`/`Mcp-Name` headers and the `_meta` envelope the
 * revision requires; a legacy one is a plain JSON-RPC POST and comes back SSE-framed.
 */
export const callToolOverHttp = async ({
  registerTools,
  authInfo,
  name,
  args,
  era = "modern",
}: {
  registerTools: (server: McpServer) => void;
  authInfo: AuthInfo;
  name: string;
  args: Record<string, unknown>;
  era?: ToolCallEra;
}): Promise<ToolCallOutcome> => {
  const handler = createMcpHandler(() => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerTools(server);
    return server;
  });

  const modern = era === "modern";
  const response = await handler.fetch(
    new Request("https://formbricks.test/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(modern
          ? { "Mcp-Method": "tools/call", "Mcp-Name": name, "MCP-Protocol-Version": "2026-07-28" }
          : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name,
          arguments: args,
          ...(modern
            ? {
                _meta: {
                  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
                  "io.modelcontextprotocol/clientCapabilities": {},
                },
              }
            : {}),
        },
      }),
    }),
    { authInfo }
  );

  const text = await response.text();
  // The legacy leg answers text/event-stream, the modern one application/json.
  const payload = response.headers.get("content-type")?.includes("text/event-stream")
    ? text
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trim())
        .join("")
    : text;

  return JSON.parse(payload) as ToolCallOutcome;
};

/** The text of a tool result's content blocks, which is where a tool error's message lands. */
export const errorText = (outcome: ToolCallOutcome) =>
  outcome.result?.content?.map((block) => block.text ?? "").join("") ?? "";

import { NextRequest } from "next/server";
import { vi } from "vitest";
import { POST } from "@/app/api/mcp/route";
import { auth } from "@/modules/auth/lib/auth";
import { getMcpOAuthJwksUrl } from "@/modules/auth/lib/oauth-urls";
import { BASE_URL } from "./oauth-flow";

/**
 * Calls `/api/mcp` the way an MCP client does: a JSON-RPC `tools/call` POSTed to the real route handler,
 * with the access token the real OAuth flow minted (`oauth-flow.ts` `grant()`), or an API key. Nothing
 * below the route is faked, so authentication, the grant, the tool guard, the v3 operation and SpiceDB
 * all run as in production.
 *
 * No server listens in the harness, and the route verifies a token against the JWKS it fetches over HTTP
 * from `getMcpOAuthJwksUrl()`. {@link serveJwksFromAuthHandler} answers that one URL from
 * `auth.handler`, which serves the same keys the provider signed with. Every other request goes to the
 * real `fetch`.
 */

/** Routes the JWKS fetch to `auth.handler`. Call once per file, in `beforeAll`; vitest restores globals. */
export const serveJwksFromAuthHandler = (): void => {
  const jwksUrl = getMcpOAuthJwksUrl();
  const realFetch = globalThis.fetch;
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url === jwksUrl) return auth.handler(new Request(url, init));
    return realFetch(input, init);
  });
};

/** What a `tools/call` came back with: the HTTP status, and the JSON-RPC result or error. */
export type TMcpToolCallOutcome = {
  status: number;
  /** The tool's result, when the request reached the tool. A refused call is a result with `isError`. */
  result?: {
    isError?: boolean;
    content?: { type: string; text?: string }[];
    structuredContent?: Record<string, unknown>;
  };
  /** The problem body, when the request was refused before any tool ran (401, 403, 429). */
  problem?: { status?: number; code?: string; detail?: string };
};

type TCredential = { accessToken: string } | { apiKey: string };

/** One `tools/call` through `POST /api/mcp`, on protocol 2026-07-28 (the modern leg, plain JSON). */
export const callMcpTool = async (
  credential: TCredential,
  name: string,
  args: Record<string, unknown>
): Promise<TMcpToolCallOutcome> => {
  const response = await POST(
    new NextRequest(`${BASE_URL}/api/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "Mcp-Method": "tools/call",
        "Mcp-Name": name,
        "MCP-Protocol-Version": "2026-07-28",
        ...("accessToken" in credential
          ? { authorization: `Bearer ${credential.accessToken}` }
          : { "x-api-key": credential.apiKey }),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name,
          arguments: args,
          _meta: {
            "io.modelcontextprotocol/protocolVersion": "2026-07-28",
            "io.modelcontextprotocol/clientCapabilities": {},
          },
        },
      }),
    })
  );

  const body = (await response.json()) as { result: TMcpToolCallOutcome["result"] } & Record<string, unknown>;
  if (body.result) return { status: response.status, result: body.result };
  return { status: response.status, problem: body as TMcpToolCallOutcome["problem"] };
};

/** The text of a tool result, which is where a refused tool's problem detail lands. */
export const toolText = (outcome: TMcpToolCallOutcome): string =>
  outcome.result?.content?.map((block) => block.text ?? "").join("") ?? "";

/** True when the call reached a tool and the tool answered without an error. */
export const succeeded = (outcome: TMcpToolCallOutcome): boolean =>
  outcome.status === 200 && outcome.result !== undefined && outcome.result.isError !== true;

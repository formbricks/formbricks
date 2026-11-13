import { type APIRequestContext, expect } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";

/**
 * An MCP client as the specs drive it: it discovers the authorization server from the MCP endpoint's
 * 401 challenge, registers itself through DCR, and exchanges the code the consent screen redirects to,
 * the way Claude or ChatGPT does (RFC 9728, RFC 8414, RFC 7591, OAuth 2.1 with PKCE). Nothing is
 * seeded or stubbed: the browser walks the real consent screen between `authorizeUrl` and `exchange`.
 *
 * The redirect URI is a loopback one, as for a desktop client. Nothing listens on it; the spec answers
 * it with `page.route` and reads the code off the URL.
 */
export const MCP_CLIENT_REDIRECT_URI = "http://127.0.0.1:33418/callback";

export type TMcpClient = {
  clientId: string;
  /** The scopes the client asks for: everything the protected-resource metadata advertises. */
  scope: string;
  resource: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
};

/** The `resource_metadata` URL of a `WWW-Authenticate: Bearer ...` challenge. */
const resourceMetadataUrlOf = (challenge: string | undefined): string => {
  const match = /resource_metadata="([^"]+)"/.exec(challenge ?? "");
  expect(match, `no resource_metadata in the challenge: ${challenge}`).not.toBeNull();
  return (match as RegExpExecArray)[1];
};

/** RFC 8414 §3.1: the well-known segment goes between the issuer's origin and its path. */
const authorizationServerMetadataUrlOf = (issuer: string): string => {
  const url = new URL(issuer);
  const path = url.pathname === "/" ? "" : url.pathname;
  return `${url.origin}/.well-known/oauth-authorization-server${path}`;
};

const getJson = async <T>(request: APIRequestContext, url: string): Promise<T> => {
  const response = await request.get(url);
  expect(response.status(), `GET ${url}`).toBe(200);
  return (await response.json()) as T;
};

/** Discovery from an unauthenticated call to `/api/mcp`, then Dynamic Client Registration. */
export const registerMcpClient = async (
  request: APIRequestContext,
  clientName: string
): Promise<TMcpClient> => {
  const unauthenticated = await request.post("/api/mcp", {
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
  });
  expect(unauthenticated.status()).toBe(401);

  const protectedResource = await getJson<{
    resource: string;
    authorization_servers: string[];
    scopes_supported: string[];
  }>(request, resourceMetadataUrlOf(unauthenticated.headers()["www-authenticate"]));
  const authorizationServer = await getJson<{
    authorization_endpoint: string;
    token_endpoint: string;
    registration_endpoint: string;
  }>(request, authorizationServerMetadataUrlOf(protectedResource.authorization_servers[0]));

  const scope = protectedResource.scopes_supported.join(" ");
  const registration = await request.post(authorizationServer.registration_endpoint, {
    data: {
      client_name: clientName,
      redirect_uris: [MCP_CLIENT_REDIRECT_URI],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      application_type: "native",
      scope,
    },
  });
  const registered = (await registration.json()) as { client_id?: string };
  expect(registration.status(), JSON.stringify(registered)).toBe(201);

  return {
    clientId: registered.client_id as string,
    scope,
    resource: protectedResource.resource,
    authorizationEndpoint: authorizationServer.authorization_endpoint,
    tokenEndpoint: authorizationServer.token_endpoint,
  };
};

/** The URL the client opens in the user's browser, and the PKCE verifier it keeps for the exchange. */
export const startMcpAuthorization = (client: TMcpClient): { url: string; verifier: string } => {
  const verifier = randomBytes(32).toString("base64url");
  const query = new URLSearchParams({
    response_type: "code",
    client_id: client.clientId,
    redirect_uri: MCP_CLIENT_REDIRECT_URI,
    scope: client.scope,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    resource: client.resource,
    state: randomBytes(8).toString("hex"),
  });
  return { url: `${client.authorizationEndpoint}?${query}`, verifier };
};

export type TMcpTokens = { access_token: string; refresh_token: string; scope: string };

/** Exchanges the authorization code for tokens. */
export const exchangeMcpCode = async (
  request: APIRequestContext,
  client: TMcpClient,
  code: string,
  verifier: string
): Promise<TMcpTokens> => {
  const response = await request.post(client.tokenEndpoint, {
    form: {
      grant_type: "authorization_code",
      code,
      redirect_uri: MCP_CLIENT_REDIRECT_URI,
      client_id: client.clientId,
      code_verifier: verifier,
      resource: client.resource,
    },
  });
  const body = (await response.json()) as TMcpTokens;
  expect(response.status(), JSON.stringify(body)).toBe(200);
  return body;
};

/** A refresh grant, as the client sends when its access token is refused. */
export const refreshMcpToken = (request: APIRequestContext, client: TMcpClient, refreshToken: string) =>
  request.post(client.tokenEndpoint, {
    form: { grant_type: "refresh_token", refresh_token: refreshToken, client_id: client.clientId },
  });

export type TMcpToolCall = {
  status: number;
  /** The tool's result when the request reached a tool; a refused tool is a result with `isError`. */
  result?: { isError?: boolean; content?: { type: string; text?: string }[] };
};

/** One `tools/call` through `POST /api/mcp` with the access token (protocol 2026-07-28, plain JSON). */
export const callMcpTool = async (
  request: APIRequestContext,
  accessToken: string,
  name: string,
  args: Record<string, unknown>
): Promise<TMcpToolCall> => {
  const response = await request.post("/api/mcp", {
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "Mcp-Method": "tools/call",
      "Mcp-Name": name,
      "MCP-Protocol-Version": "2026-07-28",
    },
    data: {
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
    },
  });
  const body = (await response.json().catch(() => ({}))) as { result: TMcpToolCall["result"] };
  return { status: response.status(), result: body.result };
};

const textOf = (call: TMcpToolCall): string =>
  call.result?.content?.map((block) => block.text ?? "").join("") ?? "";

/** The parsed JSON a tool answered with; fails the test when the tool refused. */
export const expectToolSucceeded = <T>(call: TMcpToolCall): T => {
  expect(call.status, textOf(call)).toBe(200);
  expect(call.result?.isError ?? false, textOf(call)).toBe(false);
  return JSON.parse(textOf(call)) as T;
};

/** The problem a refused tool answered with. */
export const expectToolRefused = (call: TMcpToolCall): { status: number; code: string; detail?: string } => {
  expect(call.status, textOf(call)).toBe(200);
  expect(call.result?.isError, textOf(call)).toBe(true);
  return (JSON.parse(textOf(call)) as { error: { status: number; code: string; detail?: string } }).error;
};

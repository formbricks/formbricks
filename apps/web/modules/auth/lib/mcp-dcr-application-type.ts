import "server-only";

/**
 * Default `application_type` to `"native"` on Dynamic Client Registration when the client asked for
 * loopback redirect URIs and did not say which kind of client it is (ENG-2343).
 *
 * Better Auth 1.7 added redirect-URI validation that 1.6 did not have, and for dynamic registration it
 * hardcodes the `application_type` default to `"web"`
 * (`@better-auth/oauth-provider` — `applyOAuthClientRegistrationDefaults(client, … : "web")`, then
 * `validateClientRedirectUri(uri, applicationType ?? "web")`). A `"web"` client is refused any loopback
 * URI outright: `if (!isHttps || isRedirectLoopback) invalidRedirectUri(...)`.
 *
 * Loopback is exactly what a local MCP client uses — `http://127.0.0.1:<port>/callback` — and the MCP
 * SDK posts the client's metadata verbatim, so a client that omits `application_type` (MCP Inspector's
 * shape) would get `400 invalid_redirect_uri` before consent on 1.7 having worked on 1.6. There is no
 * plugin option for the default: it is a literal at the call site. Self-hosters cannot fix it either,
 * because the clients are not theirs to change — so it is normalized here.
 *
 * The inference is narrow and spec-aligned. RFC 8252 §7.3 defines loopback redirection as the native-app
 * pattern, so a registration whose redirect URIs are *all* http loopback is a native client by
 * definition; a browser app would not use one. We only fill the field in when it is absent, and only
 * when every URI is http on one of the three hosts upstream itself accepts for native
 * (`localhost`, `127.0.0.1`, `[::1]`) — so the value we supply is guaranteed to pass the validation that
 * follows. Anything else is passed through untouched and upstream decides, exactly as before.
 */

const DCR_PATH_SEGMENT = "/api/auth/oauth2/register";
const NATIVE_HTTP_LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const isNativeHttpLoopback = (uri: unknown): boolean => {
  if (typeof uri !== "string") return false;
  try {
    const url = new URL(uri);
    return url.protocol === "http:" && NATIVE_HTTP_LOOPBACK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
};

/** Whether this request is a dynamic client registration whose body we should look at. */
export const isDcrRegistration = (request: Request): boolean => {
  if (request.method !== "POST") return false;
  try {
    return new URL(request.url).pathname.endsWith(DCR_PATH_SEGMENT);
  } catch {
    return false;
  }
};

/**
 * The registration body with `application_type: "native"` filled in when it was absent and every
 * redirect URI is an http loopback. Returns the input unchanged in every other case, including a body
 * that is not JSON or not an object — this must never be the reason a registration fails.
 */
export const withInferredApplicationType = (body: string): string => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return body;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return body;

  const client = parsed as Record<string, unknown>;
  if (client.application_type !== undefined) return body;

  const redirectUris = client.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0) return body;
  if (!redirectUris.every(isNativeHttpLoopback)) return body;

  return JSON.stringify({ ...client, application_type: "native" });
};

/**
 * The request Better Auth should handle. Reads the body only for a DCR POST, and always reconstructs
 * with the body it read — a Request body is single-use, so it cannot be inspected and then reused.
 */
export const normalizeDcrRequest = async (request: Request): Promise<Request> => {
  if (!isDcrRegistration(request)) return request;

  const raw = await request.text();
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: withInferredApplicationType(raw),
    signal: request.signal,
  });
};

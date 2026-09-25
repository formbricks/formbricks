import "server-only";
import { findDisallowedRedirectUri, isLoopbackRedirectUri } from "./mcp-dcr-redirect-policy";

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
 * pattern, so a registration that asks for one is a native client; a browser app would not. We fill the
 * field in only when it is absent and at least one redirect URI is http on one of the three hosts
 * upstream itself accepts for native (`localhost`, `127.0.0.1`, `[::1]`). Anything else is passed
 * through untouched and upstream decides, exactly as before.
 *
 * Deliberately "at least one" rather than "all": a native client may legitimately register a loopback
 * URI *and* an https one (an app-claimed universal link), a shape upstream accepts under `native` and
 * 1.6 accepted unconditionally — requiring every URI to be loopback would have made that combination
 * newly fail, which is the regression this whole file exists to prevent. Verified against the live
 * endpoint that widening this does not widen what gets accepted: upstream refuses a non-loopback http
 * redirect under `native` too (`native` + `http://evil.example.com` → `invalid_redirect_uri`), so the
 * only URIs this can green-light are loopback and https ones. It never turns a rejected URI into an
 * accepted one; it only stops a native client being misfiled as a web one.
 *
 * This module also owns the *rejection* side of dynamic registration — see `prepareDcrRequest` and
 * mcp-dcr-redirect-policy.ts (ENG-3086). The two live together because a Request body can only be read
 * once: the allowlist and this inference have to share that single read, and the same read is what
 * forces both to happen in the route rather than in a Better Auth hook.
 */

const DCR_PATH_SEGMENT = "/api/auth/oauth2/register";

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
 * The registration body with `application_type: "native"` filled in when it was absent and at least one
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
  if (!redirectUris.some(isLoopbackRedirectUri)) return body;

  return JSON.stringify({ ...client, application_type: "native" });
};

/**
 * The request Better Auth should handle — or the rejection for a registration whose redirect URIs
 * fall outside the loopback allowlist (ENG-3086). Reads the body only for a DCR POST, and always
 * reconstructs with the body it read — a Request body is single-use, so it cannot be inspected and
 * then reused.
 */
export const prepareDcrRequest = async (request: Request): Promise<Request | Response> => {
  if (!isDcrRegistration(request)) return request;

  const raw = await request.text();
  const disallowed = findDisallowedRedirectUri(raw);
  if (disallowed) {
    return Response.json(
      {
        error: "invalid_redirect_uri",
        error_description: `"${disallowed.uri}" in ${disallowed.field} is not an allowed loopback redirect URI`,
      },
      { status: 400 }
    );
  }

  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: withInferredApplicationType(raw),
    signal: request.signal,
  });
};

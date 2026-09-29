import "server-only";

/**
 * Redirect-URI allowlist for the open Dynamic Client Registration endpoint (ENG-3086).
 *
 * Unauthenticated DCR (RFC 7591) at `/api/auth/oauth2/register` accepts a self-asserted
 * `redirect_uris` array, so an anonymous caller can register a client that points at an
 * attacker-controlled redirect URI and then drive a consent-phishing flow against it. Better Auth's
 * own validation is syntactic: it confirms each URI is well-formed for the client's application type
 * and matches exactly at token exchange, but it does not restrict *which* hosts an anonymous caller
 * may claim — an arbitrary `https` URI is accepted for both `web` and `native` clients (the latter
 * via RFC 8252 §8.3 "claimed https").
 *
 * The only legitimate consumers of this endpoint are local MCP clients (Claude Desktop, Cursor, the
 * MCP Inspector), which redirect to a loopback address on the user's own machine — a URI a remote
 * attacker can never receive a code at. So anonymous registration is restricted to `http` loopback
 * (`localhost`, `127.0.0.1`, `[::1]`, any port), the native-app redirect pattern (RFC 8252 §7.3).
 * Anything else is rejected before it reaches Better Auth, with the same `invalid_redirect_uri` the
 * plugin itself would emit for a malformed redirect.
 *
 * Deliberately NOT allowed: private-use reverse-domain schemes (`com.example.app:/cb`, RFC 8252
 * §7.1) and app-claimed `https` universal links (§8.3). No current MCP client uses either, and
 * adding one back is a one-line policy decision if a client ever needs it — until then the strictest
 * allowlist is the safe default.
 */

const LOOPBACK_REDIRECT_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Whether a redirect URI is an http loopback address (RFC 8252 §7.3). */
export const isLoopbackRedirectUri = (uri: unknown): boolean => {
  if (typeof uri !== "string") return false;
  try {
    const url = new URL(uri);
    return url.protocol === "http:" && LOOPBACK_REDIRECT_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
};

const REDIRECT_URI_FIELDS = ["redirect_uris", "post_logout_redirect_uris"] as const;

export type TDisallowedRedirectUri = {
  field: (typeof REDIRECT_URI_FIELDS)[number];
  uri: string;
};

/**
 * The first redirect URI in a DCR body that the loopback allowlist rejects, or `null` when the body
 * is not JSON, not an object, or carries no redirect URIs. Those cases are Better Auth's to decide —
 * this check must only *tighten* what upstream accepts, never reject a request upstream would allow,
 * so a body with no `redirect_uris` passes through unchanged and produces upstream's own error.
 */
export const findDisallowedRedirectUri = (body: string): TDisallowedRedirectUri | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const client = parsed as Record<string, unknown>;
  for (const field of REDIRECT_URI_FIELDS) {
    const uris = client[field];
    if (!Array.isArray(uris)) continue;
    for (const uri of uris) {
      if (typeof uri === "string" && !isLoopbackRedirectUri(uri)) return { field, uri };
    }
  }
  return null;
};

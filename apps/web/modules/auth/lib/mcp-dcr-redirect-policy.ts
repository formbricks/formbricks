import "server-only";
import { logger } from "@formbricks/logger";
import { env } from "@/lib/env";

/**
 * Redirect-URI allowlist for the open Dynamic Client Registration endpoint (ENG-3086, ENG-3471).
 *
 * Unauthenticated DCR (RFC 7591) at `/api/auth/oauth2/register` accepts a self-asserted
 * `redirect_uris` array, so an anonymous caller can register a client that points at an
 * attacker-controlled redirect URI and then drive a consent-phishing flow against it. Better Auth's
 * own validation is syntactic: it confirms each URI is well-formed for the client's application type
 * and matches exactly at token exchange, but it does not restrict *which* hosts an anonymous caller
 * may claim — an arbitrary `https` URI is accepted for both `web` and `native` clients (the latter
 * via RFC 8252 §8.3 "claimed https").
 *
 * So anonymous registration may only claim a redirect URI an attacker can never receive a code at:
 *
 * 1. `http` loopback (`localhost`, `127.0.0.1`, `[::1]`, any port) — the native-app pattern (RFC 8252
 *    §7.3) local MCP clients use (Claude Code, Codex, MCP Inspector). The code lands on the user's own
 *    machine.
 * 2. An exact hosted-connector callback (`HOSTED_MCP_CLIENT_REDIRECT_URIS`, plus any an operator adds
 *    through `MCP_DCR_ALLOWED_REDIRECT_URIS`). claude.ai and ChatGPT connect from the vendor's cloud and
 *    register a fixed `https` callback on the vendor's own origin. Anyone can register a client with one
 *    of these, but the code is only ever delivered to that vendor — which rejects a `state` it did not
 *    issue — never to the registrant. Matched by exact string, as OAuth 2.1 / RFC 9700 §4.1 require:
 *    no prefix, host or wildcard matching, so a lookalike host, another path, a trailing slash or an
 *    added query string is a different URI and is refused. Better Auth matches https redirect URIs
 *    exactly at `/authorize` too (`findRegisteredRedirectUri`), so a registered callback cannot be
 *    widened later either.
 *
 * Anything else is rejected before it reaches Better Auth, with the same `invalid_redirect_uri` the
 * plugin itself would emit for a malformed redirect.
 *
 * Hosted callbacks are allowed for `redirect_uris` only. `post_logout_redirect_uris` stays loopback-only:
 * no hosted connector registers one, so there is nothing to gain from widening it.
 *
 * Deliberately NOT allowed: private-use reverse-domain schemes (`com.example.app:/cb`, RFC 8252
 * §7.1) and other app-claimed `https` universal links (§8.3). No current MCP client uses either, and
 * adding one is a policy decision for this list rather than a pattern.
 */

/**
 * Callbacks of hosted MCP clients that register through DCR. Each is an exact URI, never a host.
 *
 * - claude.ai / Claude Desktop / mobile custom connectors: `https://claude.ai/api/mcp/auth_callback`
 *   (https://claude.com/docs/connectors/building/authentication). Claude's DCR body lists the
 *   `claude.com` callback alongside it in the same `redirect_uris`, and the gate rejects a body on its
 *   first disallowed URI — so both must be here or claude.ai cannot register at all.
 * - ChatGPT connectors: `https://chatgpt.com/connector_platform_oauth_redirect`
 *   (https://developers.openai.com/plugins/build/auth). ChatGPT uses this stable callback only when the
 *   authorization server supports RFC 9207 issuer identification; otherwise it falls back to a
 *   per-connector `/connector/oauth/{callback_id}` that no exact list can cover. Better Auth advertises
 *   `authorization_response_iss_parameter_supported` and returns `iss`, so the stable one is what we get.
 */
export const HOSTED_MCP_CLIENT_REDIRECT_URIS = [
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
  "https://chatgpt.com/connector_platform_oauth_redirect",
] as const;

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

/** The exact-match set: the built-in hosted callbacks plus any operator additions. */
export const buildAllowedDcrRedirectUris = (operatorUris: readonly string[] = []): ReadonlySet<string> =>
  new Set<string>([...HOSTED_MCP_CLIENT_REDIRECT_URIS, ...operatorUris]);

/** Origin and path only: a callback's query string can carry a per-tenant secret, and logs leave the box. */
const describeRedirectUri = (uri: string): string => {
  const url = new URL(uri);
  return `${url.origin}${url.pathname}`;
};

let allowedDcrRedirectUris: ReadonlySet<string> | undefined;

/** The allowlist this process enforces. Built once; env does not change at runtime. */
export const getAllowedDcrRedirectUris = (): ReadonlySet<string> => {
  if (!allowedDcrRedirectUris) {
    const operatorUris = env.MCP_DCR_ALLOWED_REDIRECT_URIS ?? [];
    if (operatorUris.length > 0) {
      logger.info(
        { redirectUris: operatorUris.map(describeRedirectUri) },
        "MCP_DCR_ALLOWED_REDIRECT_URIS adds redirect URIs to anonymous OAuth client registration"
      );
    }
    allowedDcrRedirectUris = buildAllowedDcrRedirectUris(operatorUris);
  }
  return allowedDcrRedirectUris;
};

/** Whether anonymous DCR may register this `redirect_uris` entry: loopback, or an exact allowlisted URI. */
export const isAllowedDcrRedirectUri = (uri: unknown, allowed: ReadonlySet<string>): boolean =>
  isLoopbackRedirectUri(uri) || (typeof uri === "string" && allowed.has(uri));

const REDIRECT_URI_FIELDS = ["redirect_uris", "post_logout_redirect_uris"] as const;

type TRedirectUriField = (typeof REDIRECT_URI_FIELDS)[number];

export type TDisallowedRedirectUri = {
  field: TRedirectUriField;
  uri: string;
};

const isAllowedForField = (field: TRedirectUriField, uri: string, allowed: ReadonlySet<string>): boolean =>
  field === "redirect_uris" ? isAllowedDcrRedirectUri(uri, allowed) : isLoopbackRedirectUri(uri);

/**
 * The first redirect URI in a DCR body that the allowlist rejects, or `null` when the body is not
 * JSON, not an object, or carries no redirect URIs. Those cases are Better Auth's to decide — this
 * check must only *tighten* what upstream accepts, never reject a request upstream would allow, so a
 * body with no `redirect_uris` passes through unchanged and produces upstream's own error.
 */
export const findDisallowedRedirectUri = (
  body: string,
  allowed: ReadonlySet<string>
): TDisallowedRedirectUri | null => {
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
      if (typeof uri === "string" && !isAllowedForField(field, uri, allowed)) return { field, uri };
    }
  }
  return null;
};

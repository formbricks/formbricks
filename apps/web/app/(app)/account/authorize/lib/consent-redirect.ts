/**
 * Extract the post-consent redirect URL from a Better Auth `oauth2.consent` response.
 *
 * On accept, `@better-auth/oauth-provider` delegates to its authorize handler, which for a fetch/JSON
 * request returns `{ redirect: true, url: "<callback?code=…>" }` (see `handleRedirect` in the plugin) —
 * NOT `{ redirect_uri }`. The plugin's OpenAPI schema documents `redirect_uri`, which is misleading;
 * the runtime field is `url`. Deny returns the same shape with an `error=access_denied` URL. We read
 * `url` first, and keep `redirect_uri` as a defensive fallback for the documented/legacy shape.
 *
 * Security: the returned string is fed to `window.location.href`, so we reject `javascript:`/`data:`
 * URLs (never valid OAuth redirect targets; the XSS vector for a location sink). We do NOT restrict to
 * http/https — native MCP clients use loopback (`http://127.0.0.1:PORT`) and custom app schemes, and the
 * oauth-provider already validated the target `redirect_uri` against the registered client at
 * `/authorize`. The value here always originates from that pre-validated callback.
 */
const DANGEROUS_SCHEME = /^\s*(?:javascript|data|vbscript):/i;

const asRedirectString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (DANGEROUS_SCHEME.test(trimmed)) return null;
  return trimmed;
};

export const resolveConsentRedirectUrl = (data: unknown): string | null => {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  return asRedirectString(record.url) ?? asRedirectString(record.redirect_uri);
};

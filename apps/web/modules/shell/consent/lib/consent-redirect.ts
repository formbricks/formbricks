/**
 * Extract the post-consent redirect URL from a Better Auth `oauth2.consent` response.
 *
 * On accept, `@better-auth/oauth-provider` delegates to its authorize handler, which for a fetch/JSON
 * request returns `{ redirect: true, url: "<callback?code=…>" }` (see `handleRedirect` in the plugin) —
 * NOT `{ redirect_uri }`. The plugin's OpenAPI schema documents `redirect_uri`, which is misleading;
 * the runtime field is `url`. Deny returns the same shape with an `error=access_denied` URL. We read
 * `url` first, and keep `redirect_uri` as a defensive fallback for the documented/legacy shape.
 *
 * Security: the returned string is fed to `window.location.href`, so we reject XSS-capable schemes.
 * We parse with the `URL` constructor and deny the dangerous protocols rather than allowlisting — native
 * MCP clients use arbitrary custom/loopback schemes (`cursor://`, `vscode://`, `http://127.0.0.1:PORT`),
 * so the safe set can't be enumerated, and the oauth-provider already validated the target `redirect_uri`
 * against the registered client at `/authorize`. Parsing (vs a regex) also normalizes obfuscated schemes
 * like `java\tscript:` and rejects malformed / protocol-relative values.
 */
const DANGEROUS_PROTOCOLS = new Set(["javascript:", "data:", "vbscript:", "file:", "blob:"]);

const asRedirectString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  let protocol: string;
  try {
    protocol = new URL(trimmed).protocol;
  } catch {
    return null; // not a well-formed absolute URL
  }
  if (DANGEROUS_PROTOCOLS.has(protocol.toLowerCase())) return null;
  return trimmed;
};

export const resolveConsentRedirectUrl = (data: unknown): string | null => {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  return asRedirectString(record.url) ?? asRedirectString(record.redirect_uri);
};

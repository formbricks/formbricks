/**
 * Size limits on an anonymous Dynamic Client Registration body (ENG-7314).
 *
 * `/api/auth` caps every body at 256 KiB (auth-request-body-limit.ts), which is the right ceiling for
 * the SAML callback but far above a client registration: a real one is about 1 KB. Registration is
 * open and every accepted body is stored as an `oauthClient` row, so at the 5-per-minute IP limit the
 * 256 KiB ceiling let one address store ~1.8 GB a day. These limits keep the stored row near what an
 * honest client sends.
 *
 * 8 KiB leaves room for every field RFC 7591 defines at its widest. 512 characters per string covers
 * the longest legitimate value (a `jwks` RSA modulus is ~342 characters) and any redirect URI the
 * allowlist can admit. Neither is a limit an MCP client will notice.
 */
export const DCR_MAX_BODY_BYTES = 8 * 1024;
export const DCR_MAX_STRING_LENGTH = 512;

export type TDcrSizeViolation = { description: string };

const hasOverlongString = (value: unknown): boolean => {
  if (typeof value === "string") return value.length > DCR_MAX_STRING_LENGTH;
  if (value === null || typeof value !== "object") return false;
  // Object keys are caller-chosen text too, so they count the same as values.
  const children = Array.isArray(value) ? value : Object.entries(value).flat();
  return children.some(hasOverlongString);
};

/**
 * What is wrong with the registration body's size, or null when it is within limits. A body that is not
 * JSON is not this function's to judge: upstream refuses it, and this must never be the reason a
 * well-formed registration fails.
 */
export const findDcrSizeViolation = (raw: string): TDcrSizeViolation | null => {
  const bytes = Buffer.byteLength(raw, "utf8");
  if (bytes > DCR_MAX_BODY_BYTES) {
    return { description: `Client registration must not exceed ${DCR_MAX_BODY_BYTES} bytes` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  return hasOverlongString(parsed)
    ? { description: `Client registration values must not exceed ${DCR_MAX_STRING_LENGTH} characters` }
    : null;
};

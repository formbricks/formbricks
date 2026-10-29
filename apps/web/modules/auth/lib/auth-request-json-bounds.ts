/**
 * Most entries any array or object in an `/api/auth/*` JSON body may hold (ENG-6797).
 *
 * Better Auth and its plugins validate these bodies with schemas we do not own, and many of their arrays
 * and records carry no size limit: `scopes` on social sign-in, `redirect_uris`, `contacts` and the rest of
 * a dynamic client registration. Zod reports each bad item of such a collection on its own, so the limit
 * has to be checked on the raw body, before Better Auth parses it.
 *
 * 100 is far above anything these routes legitimately receive: the longest list a client sends is the
 * MCP scope set (14 entries), and a registration or sign-up body has a few dozen fields at most.
 */
export const AUTH_REQUEST_MAX_JSON_ENTRIES = 100;

// The same test better-call applies before it parses a body as JSON. A form or multipart body becomes a
// flat map of strings there, so it carries no array for the limit to look at.
const JSON_CONTENT_TYPE = /^application\/([a-z0-9.+-]*\+)?json/i;

/**
 * Whether any array or object in `value` holds more than `maxEntries` entries. Walks with an explicit
 * stack, so how deeply the body nests costs no call depth.
 */
export const hasOversizedJsonCollection = (value: unknown, maxEntries: number): boolean => {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current !== "object" || current === null) continue;
    const entries = Array.isArray(current) ? current : Object.values(current);
    if (entries.length > maxEntries) return true;
    pending.push(...entries);
  }
  return false;
};

/**
 * Whether `body` is a JSON request body with a collection over {@link AUTH_REQUEST_MAX_JSON_ENTRIES}.
 * A body that is not JSON, or does not parse, is left to the handler, which answers it as before.
 */
export const exceedsAuthJsonBounds = (contentType: string | null, body: Uint8Array): boolean => {
  if (!contentType || !JSON_CONTENT_TYPE.test(contentType)) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return false;
  }
  return hasOversizedJsonCollection(parsed, AUTH_REQUEST_MAX_JSON_ENTRIES);
};

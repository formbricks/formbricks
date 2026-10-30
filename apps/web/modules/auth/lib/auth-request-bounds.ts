/**
 * Most entries any list or map in an `/api/auth/*` request may hold (ENG-6797): an array or object in a
 * JSON body, a parameter repeated in the query or a form body, or the JSON a parameter carries as text.
 *
 * Better Auth and its plugins validate these requests with schemas we do not own, and many of their arrays
 * and records carry no size limit: `scopes` on social sign-in, `redirect_uris` and `contacts` on dynamic
 * client registration, `resource` on authorize (repeated in the query), `claims` on authorize (JSON in a
 * form field or the query). Zod reports each bad item of such a collection on its own, so the limit has to
 * be checked on the raw request, before Better Auth parses it.
 *
 * 100 is far above anything these routes legitimately receive: the longest list a client sends is the
 * MCP scope set (14 entries), and a registration or sign-up body has a few dozen fields at most.
 */
export const AUTH_REQUEST_MAX_ENTRIES = 100;

// The test better-call applies before it parses a body as JSON (`getBody`); auth-request-bounds.test.ts
// keeps the two in step. Every other body type it hands over as text or as a flat map of strings.
const JSON_CONTENT_TYPE = /^application\/([a-z0-9.+-]*\+)?json/i;

export const isJsonContentType = (contentType: string | null): boolean =>
  contentType !== null && JSON_CONTENT_TYPE.test(contentType);

/**
 * Whether any array or object in `value` holds more than `maxEntries` entries. Walks with an explicit
 * stack, so how deeply the value nests costs no call depth.
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

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/**
 * Whether a query string or form body repeats a parameter more than the cap allows, or carries a value
 * that is JSON with an oversized collection. better-call turns a repeated query parameter into an array,
 * and oauth-provider parses `claims` from text, so both reach a schema as collections.
 */
const hasOversizedParams = (params: URLSearchParams): boolean => {
  const counts = new Map<string, number>();
  for (const [key, value] of params) {
    const count = (counts.get(key) ?? 0) + 1;
    if (count > AUTH_REQUEST_MAX_ENTRIES) return true;
    counts.set(key, count);
    if (
      (value.startsWith("{") || value.startsWith("[")) &&
      hasOversizedJsonCollection(parseJson(value), AUTH_REQUEST_MAX_ENTRIES)
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Whether a request's query string or body holds a collection over {@link AUTH_REQUEST_MAX_ENTRIES}.
 * Only the body types Better Auth parses into collections are read: JSON, and form bodies (for the JSON
 * their fields carry). A body that does not parse is left to the handler, which answers it as before.
 */
export const exceedsAuthRequestBounds = (
  url: string,
  contentType: string | null,
  body: Uint8Array | undefined
): boolean => {
  if (hasOversizedParams(new URL(url).searchParams)) return true;
  if (!body) return false;
  if (isJsonContentType(contentType)) {
    return hasOversizedJsonCollection(parseJson(new TextDecoder().decode(body)), AUTH_REQUEST_MAX_ENTRIES);
  }
  if (contentType?.toLowerCase().includes("application/x-www-form-urlencoded")) {
    return hasOversizedParams(new URLSearchParams(new TextDecoder().decode(body)));
  }
  return false;
};

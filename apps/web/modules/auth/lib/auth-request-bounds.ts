/**
 * Most entries any list or map in an `/api/auth/*` request may hold (ENG-6797): an array or object in a
 * JSON body, the parameters of a query string or form body, or the JSON a value carries as text.
 *
 * Better Auth and its plugins validate these requests with schemas we do not own, and many of their arrays
 * and records carry no size limit: `scopes` on social sign-in, `redirect_uris` and `contacts` on dynamic
 * client registration, `resource` on authorize (repeated in the query), `claims` on authorize and consent
 * (JSON text in a form field, the query or a JSON body). Zod reports each bad item of such a collection
 * on its own, so the limit has to be checked on the raw request, before Better Auth parses it.
 *
 * 100 is far above anything these routes legitimately receive: the longest list a client sends is the
 * MCP scope set (14 entries), an OAuth or SAML callback carries a few parameters, and a registration or
 * sign-up body has a few dozen fields at most. JSON inside another encoding — a JWT payload such as
 * `id_token_hint` — is not inspected: Better Auth decodes those without a schema or a per-entry loop.
 */
export const AUTH_REQUEST_MAX_ENTRIES = 100;

/**
 * Most values one request may carry as JSON text. Reading one means parsing it, so without a budget a
 * body of many short strings that only look like JSON costs a failed parse each. A real request carries
 * at most one (`claims`); past the budget the request is refused.
 */
export const AUTH_REQUEST_MAX_JSON_TEXTS = 10;

// The test better-call applies before it parses a body as JSON (`getBody`); auth-request-bounds.test.ts
// keeps the two in step. Every other body type it hands over as text or as a flat map of strings.
const JSON_CONTENT_TYPE = /^application\/([a-z0-9.+-]*\+)?json/i;

export const isJsonContentType = (contentType: string | null): boolean =>
  contentType !== null && JSON_CONTENT_TYPE.test(contentType);

// A value `JSON.parse` would read as an array or object: JSON allows these four whitespace characters
// around it, so a consumer parsing the text accepts a padded value as readily as a bare one.
const JSON_COLLECTION_START = /^[\t\n\r ]*[[{]/;
const JSON_WHITESPACE = new Set(["\t", "\n", "\r", " "]);

// Scanned by hand rather than with an end-anchored regex, which backtracks on long runs of whitespace.
const endsLikeJsonCollection = (text: string): boolean => {
  let index = text.length - 1;
  while (index >= 0 && JSON_WHITESPACE.has(text[index])) index--;
  return text[index] === "]" || text[index] === "}";
};

const looksLikeJsonCollection = (text: string): boolean =>
  JSON_COLLECTION_START.test(text) && endsLikeJsonCollection(text);

/** What one request may still spend on reading JSON text, shared by every part of it. */
type TJsonTextBudget = { remaining: number };

const newJsonTextBudget = (): TJsonTextBudget => ({ remaining: AUTH_REQUEST_MAX_JSON_TEXTS });

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/**
 * Whether any array or object in `value` holds more than `maxEntries` entries, counting the collections
 * a string carries as JSON text: oauth-provider parses `claims` from a string on consent as well as on
 * authorize. Walks with an explicit stack, so how deeply the value nests costs no call depth. A string
 * is parsed only when it starts and ends like an array or object, and each parse spends `budget`; a value
 * that needs more parses than the budget holds counts as oversized.
 */
export const hasOversizedJsonCollection = (
  value: unknown,
  maxEntries: number,
  budget: TJsonTextBudget = newJsonTextBudget()
): boolean => {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current === "string") {
      if (looksLikeJsonCollection(current)) {
        if (--budget.remaining < 0) return true;
        pending.push(parseJson(current));
      }
      continue;
    }
    if (typeof current !== "object" || current === null) continue;
    const entries = Array.isArray(current) ? current : Object.values(current);
    if (entries.length > maxEntries) return true;
    pending.push(...entries);
  }
  return false;
};

/**
 * Whether a query string or form body holds more parameters than the cap allows, or a value that is JSON
 * with an oversized collection. Every parameter counts, repeated or not: better-call turns a repeated one
 * into an array, the whole set reaches handlers as one map (oauth-provider re-serializes it, at a cost
 * that grows faster than its size), and oauth-provider parses `claims` from text.
 */
const hasOversizedParams = (params: URLSearchParams, budget: TJsonTextBudget): boolean => {
  let count = 0;
  for (const [, value] of params) {
    if (++count > AUTH_REQUEST_MAX_ENTRIES) return true;
    if (hasOversizedJsonCollection(value, AUTH_REQUEST_MAX_ENTRIES, budget)) return true;
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
  const budget = newJsonTextBudget();
  if (hasOversizedParams(new URL(url).searchParams, budget)) return true;
  if (!body) return false;
  if (isJsonContentType(contentType)) {
    const parsed = parseJson(new TextDecoder().decode(body));
    return hasOversizedJsonCollection(parsed, AUTH_REQUEST_MAX_ENTRIES, budget);
  }
  if (contentType?.toLowerCase().includes("application/x-www-form-urlencoded")) {
    return hasOversizedParams(new URLSearchParams(new TextDecoder().decode(body)), budget);
  }
  return false;
};

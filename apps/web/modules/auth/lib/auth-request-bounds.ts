/**
 * Most entries any list or map in an `/api/auth/*` request may hold (ENG-6797): an array or object in a
 * JSON body, the parameters of a query string or form body, or the JSON a value carries as text.
 *
 * Better Auth and its plugins validate these requests with schemas we do not own, and many of their arrays
 * and records carry no size limit: `scopes` on social sign-in, `redirect_uris` and `contacts` on dynamic
 * client registration, `resource` on authorize (repeated in the query), `claims` on authorize and consent
 * (JSON text in a form field, the query or a JSON body), `oauth_query` on every POST (a query string sent
 * as one value), `scope` and `prompt` (space-separated lists). Zod reports each bad item of such a collection
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

/** The media type of a `Content-Type` header, without its parameters, lowercased. */
export const mediaTypeOf = (contentType: string | null): string =>
  (contentType ?? "").split(";")[0].trim().toLowerCase();

// Whether a body is read as a form. `withAuthRequestBodyLimit` refuses a `Content-Type` that lists more
// than one media type, so the header names one, and its media type decides: `formData()` reads a form
// only under this exact type, and better-call's allow-list refuses one named only in a parameter.
export const isFormContentType = (contentType: string | null): boolean =>
  mediaTypeOf(contentType) === "application/x-www-form-urlencoded";

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
 * Whether `text`, read the way `URLSearchParams` reads a query string or form body, holds more than `max`
 * fields. Counted by scanning for `&` rather than by parsing: `URLSearchParams` slows down sharply on many
 * fields without a value (`a&a&a…`), so it is only built once the count is known to be within the cap.
 * Empty fields are skipped, as `URLSearchParams` skips them.
 */
const hasMoreFieldsThan = (text: string, max: number): boolean => {
  let count = 0;
  let start = 0;
  while (start <= text.length) {
    const separator = text.indexOf("&", start);
    const end = separator === -1 ? text.length : separator;
    if (end > start && ++count > max) return true;
    start = end + 1;
  }
  return false;
};

/** Whether `text` splits into more than `max` items on spaces or commas, empty items included. */
const hasMoreListItemsThan = (text: string, max: number): boolean => {
  let separators = 0;
  for (let index = 0; index < text.length; index++) {
    if ((text[index] === " " || text[index] === ",") && ++separators >= max) return true;
  }
  return false;
};

/**
 * Strings Better Auth's plugins read as collections of their own, by name. oauth-provider verifies an
 * `oauth_query` on every POST before any schema runs, re-parsing and sorting all its fields, and splits
 * `scope` and `prompt` into lists it checks against each other.
 */
const isOversizedNamedValue = (name: string, value: string): boolean => {
  if (name === "oauth_query") return hasMoreFieldsThan(value, AUTH_REQUEST_MAX_ENTRIES);
  if (name === "scope" || name === "prompt") return hasMoreListItemsThan(value, AUTH_REQUEST_MAX_ENTRIES);
  return false;
};

/**
 * Whether any array or object in `value` holds more than `maxEntries` entries, counting the collections
 * a string carries as JSON text (oauth-provider parses `claims` from a string on consent as well as on
 * authorize) and the ones a named string carries ({@link isOversizedNamedValue}). Walks with an explicit
 * stack, so how deeply the value nests costs no call depth, and counts an object's keys as it goes, so an
 * oversized one is refused before its values are collected. A string is parsed only when it starts and
 * ends like an array or object, and each parse spends `budget`; a value that needs more parses than the
 * budget holds counts as oversized.
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
    if (Array.isArray(current)) {
      if (current.length > maxEntries) return true;
      pending.push(...current);
      continue;
    }
    const record = current as Record<string, unknown>;
    let count = 0;
    for (const name in record) {
      if (!Object.hasOwn(record, name)) continue;
      if (++count > maxEntries) return true;
      const entry = record[name];
      if (typeof entry === "string" && isOversizedNamedValue(name, entry)) return true;
      pending.push(entry);
    }
  }
  return false;
};

/**
 * Whether a query string or form body holds more parameters than the cap allows, or a value that is
 * itself oversized. Every parameter counts, repeated or not: better-call turns a repeated one into an
 * array, the whole set reaches handlers as one map (oauth-provider re-serializes it, at a cost that grows
 * faster than its size), and its values can carry JSON text or a named collection.
 */
const hasOversizedParams = (text: string, budget: TJsonTextBudget): boolean => {
  if (hasMoreFieldsThan(text, AUTH_REQUEST_MAX_ENTRIES)) return true;
  for (const [name, value] of new URLSearchParams(text)) {
    if (isOversizedNamedValue(name, value)) return true;
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
  if (hasOversizedParams(new URL(url).search.slice(1), budget)) return true;
  if (!body) return false;
  if (isJsonContentType(contentType)) {
    const parsed = parseJson(new TextDecoder().decode(body));
    return hasOversizedJsonCollection(parsed, AUTH_REQUEST_MAX_ENTRIES, budget);
  }
  if (isFormContentType(contentType)) {
    return hasOversizedParams(new TextDecoder().decode(body), budget);
  }
  return false;
};

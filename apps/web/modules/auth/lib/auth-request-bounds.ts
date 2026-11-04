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
 * sign-up body has a few dozen fields at most. A signed `oauth_query` is the exception, sized on its own
 * ({@link OAUTH_QUERY_MAX_FIELDS}). JSON inside another encoding — a JWT payload such as `id_token_hint` —
 * is not inspected: Better Auth decodes those without a schema or a per-entry loop.
 *
 * Checked against @better-auth/oauth-provider 1.7.0–1.7.15 and better-call 1.4: none of them bounds these
 * collections. Re-check the named values below ({@link isOversizedNamedValue}) on every upgrade.
 */
export const AUTH_REQUEST_MAX_ENTRIES = 100;

/**
 * Fields a signed `oauth_query` may carry. oauth-provider signs the authorize request it redirects to the
 * login or consent page: every parameter, plus a `ba_param` field naming each one, plus `exp`, `ba_iat`,
 * `sig` and `ba_pl` with their own `ba_param` entries. So it holds about twice the fields of the authorize
 * request, and an authorize request at {@link AUTH_REQUEST_MAX_ENTRIES} must still sign in.
 */
export const OAUTH_QUERY_MAX_FIELDS = 2 * AUTH_REQUEST_MAX_ENTRIES + 8;

/** Deepest a JSON body may nest. Better Auth's deepest real body, a JWKS in a registration, nests 4. */
export const AUTH_REQUEST_MAX_DEPTH = 32;

/**
 * Most values one request may carry as JSON text. Reading one means parsing it, so without a budget a
 * body of many short strings that only look like JSON costs a failed parse each. A real request carries
 * at most one (`claims`); past the budget the request is refused.
 */
export const AUTH_REQUEST_MAX_JSON_TEXTS = 10;

/**
 * The only request bodies `/api/auth` accepts: JSON or a form, with at most a `charset` parameter. Better
 * Auth's routes take nothing else (better-call refuses other types with 415, and a body with no
 * `Content-Type` too), but its consumers classify a body loosely: better-call matches the allow-list by
 * substring and parses JSON on an unanchored regex, and oauth-provider re-reads any body whose
 * `Content-Type` merely contains the form type as a form. A header such as
 * `application/x-www-form-urlencoded+json` would be read as JSON by one and as a form by another. Holding
 * the header to these two shapes, and a JSON header to not naming the form type anywhere, leaves one
 * reading, the one the guard checks. The charset itself is not checked: every consumer decodes UTF-8
 * whatever it says.
 */
const AUTH_BODY_CONTENT_TYPE =
  /^[\t ]*application\/(json|x-www-form-urlencoded)[\t ]*(?:;[\t ]*charset[\t ]*=[\t ]*(?:[a-z0-9!#$%&'*+.^_`|~-]+|"[a-z0-9!#$%&'*+.^_`|~ -]+")[\t ]*)?$/i;

export type TAuthBodyKind = "json" | "form";

/** How an `/api/auth` body is read, or `null` for a `Content-Type` the routes must refuse. */
export const authBodyKindOf = (contentType: string | null): TAuthBodyKind | null => {
  const match = contentType === null ? null : AUTH_BODY_CONTENT_TYPE.exec(contentType);
  if (!match) return null;
  if (match[1].toLowerCase() === "x-www-form-urlencoded") return "form";
  // oauth-provider would read this one as a form: `charset=x-www-form-urlencoded`.
  return /x-www-form-urlencoded/i.test(contentType as string) ? null : "json";
};

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
 * Empty fields are skipped as `URLSearchParams` skips them, but still cost a scan, so more than four times
 * `max` of them counts as oversized too.
 */
const hasMoreFieldsThan = (text: string, max: number): boolean => {
  let fields = 0;
  let segments = 0;
  let start = 0;
  while (start <= text.length) {
    const separator = text.indexOf("&", start);
    const end = separator === -1 ? text.length : separator;
    if (++segments > 4 * max) return true;
    if (end > start && ++fields > max) return true;
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
  if (name === "oauth_query") return hasMoreFieldsThan(value, OAUTH_QUERY_MAX_FIELDS);
  if (name === "scope" || name === "prompt") return hasMoreListItemsThan(value, AUTH_REQUEST_MAX_ENTRIES);
  return false;
};

/**
 * Whether any array or object in `value` holds more than `maxEntries` entries or nests deeper than
 * {@link AUTH_REQUEST_MAX_DEPTH}, counting the collections a string carries as JSON text (oauth-provider
 * parses `claims` from a string on consent as well as on authorize) and the ones a named string carries
 * ({@link isOversizedNamedValue}). Walks with an explicit stack, so how deeply the value nests costs no
 * call depth, and counts an object's keys as it goes, so an oversized one is refused before its values
 * are collected. A string is parsed only when it starts and ends like an array or object, and each parse
 * spends `budget`; a value that needs more parses than the budget holds counts as oversized.
 */
export const hasOversizedJsonCollection = (
  value: unknown,
  maxEntries: number,
  budget: TJsonTextBudget = newJsonTextBudget()
): boolean => {
  const pending: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  while (pending.length > 0) {
    const { value: current, depth } = pending.pop() as { value: unknown; depth: number };
    if (typeof current === "string") {
      if (looksLikeJsonCollection(current)) {
        if (--budget.remaining < 0) return true;
        pending.push({ value: parseJson(current), depth });
      }
      continue;
    }
    if (typeof current !== "object" || current === null) continue;
    if (depth >= AUTH_REQUEST_MAX_DEPTH) return true;
    if (Array.isArray(current)) {
      if (current.length > maxEntries) return true;
      for (const entry of current) pending.push({ value: entry, depth: depth + 1 });
      continue;
    }
    const record = current as Record<string, unknown>;
    let count = 0;
    for (const name in record) {
      if (!Object.hasOwn(record, name)) continue;
      if (++count > maxEntries) return true;
      const entry = record[name];
      if (typeof entry === "string" && isOversizedNamedValue(name, entry)) return true;
      pending.push({ value: entry, depth: depth + 1 });
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
 * `kind` is the body's reading per {@link authBodyKindOf}; the caller refuses a body that has none. A JSON
 * body that does not parse is left to the handler, which answers it as before.
 */
export const exceedsAuthRequestBounds = (
  url: string,
  kind: TAuthBodyKind | null,
  body: Uint8Array | undefined
): boolean => {
  const budget = newJsonTextBudget();
  if (hasOversizedParams(new URL(url).search.slice(1), budget)) return true;
  if (!body || kind === null) return false;
  const text = new TextDecoder().decode(body);
  if (kind === "json") return hasOversizedJsonCollection(parseJson(text), AUTH_REQUEST_MAX_ENTRIES, budget);
  return hasOversizedParams(text, budget);
};

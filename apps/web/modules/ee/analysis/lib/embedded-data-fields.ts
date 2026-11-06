/**
 * Embedded data as chart fields: each Feedback Dataset's most frequent embedded-data keys
 * become `FeedbackRecords.ed_<slug>_<hash>` dimensions in that dataset's Cube model. The key list
 * travels in the Cube token, so this module decides which keys a dataset compiles; docker/cube/cube.js
 * applies the same rules again and must agree with them.
 */

/** Most of a dataset's keys its catalog offers and every token carries: the most frequent first. */
export const MAX_EMBEDDED_KEYS = 100;
/** Longest key compiled. A longer one is left out rather than truncated, so a name stays exact. */
export const MAX_EMBEDDED_KEY_LENGTH = 128;
/**
 * Most UTF-8 bytes the top keys may take in the Cube token, measured as JSON writes them
 * (`Buffer.byteLength(JSON.stringify(key))`: a quote or backslash counts twice, an accented letter two
 * bytes, a CJK character three). The token travels as an HTTP header that Node caps at 16 KiB; base64 and
 * the other claims leave room for about 8 KiB of keys, shared with `MAX_RARE_EMBEDDED_KEYS_BYTES`. 100
 * ASCII keys of 60 characters fit.
 */
export const MAX_EMBEDDED_KEYS_BYTES = 6656;
/**
 * A query naming keys outside the top keys (a saved chart whose key grew rarer) adds one fixed bucket of
 * rarer keys to the token, so every query naming a key of that bucket compiles the same model.
 */
export const MAX_RARE_EMBEDDED_KEYS = 10;
export const MAX_RARE_EMBEDDED_KEYS_BYTES = 1536;
/** Most keys one token carries; docker/cube/cube.js compiles no more (`MAX_EMBEDDED_KEYS` there). */
export const MAX_TOKEN_EMBEDDED_KEYS = MAX_EMBEDDED_KEYS + MAX_RARE_EMBEDDED_KEYS;
/** Most key bytes one token carries; docker/cube/cube.js compiles no more (`MAX_EMBEDDED_KEYS_BYTES`). */
export const MAX_TOKEN_EMBEDDED_KEYS_BYTES = MAX_EMBEDDED_KEYS_BYTES + MAX_RARE_EMBEDDED_KEYS_BYTES;

export const EMBEDDED_MEMBER_PREFIX = "FeedbackRecords.ed_";
const EMBEDDED_MEMBER_PATTERN = /^FeedbackRecords\.ed_[a-z0-9_]+$/;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
// C0 and C1 control characters, NUL included; docker/cube/cube.js refuses the same.
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL_CHARACTER = /[\u0000-\u001F\u007F-\u009F]/;

export const isEmbeddedMemberName = (name: string): boolean => EMBEDDED_MEMBER_PATTERN.test(name);

/**
 * The numeric twin of every embedded-data dimension: `FeedbackRecords.edn_<suffix>` beside
 * `FeedbackRecords.ed_<suffix>`, the key's value read as a number, or no value when it is not one
 * (docker/cube/cube.js `getEmbeddedDimensionSpecs`). Only a dashboard filter comparing a key with a number
 * (`gt`, `gte`, `lt`, `lte`) names it, and only in a filter: the key's own member stays the one a chart
 * groups by, and the one its `equals` reaches the GIN index through.
 */
export const EMBEDDED_NUMBER_MEMBER_PREFIX = "FeedbackRecords.edn_";
const EMBEDDED_NUMBER_MEMBER_PATTERN = /^FeedbackRecords\.edn_[a-z0-9_]+$/;

export const isEmbeddedNumberMemberName = (name: string): boolean =>
  EMBEDDED_NUMBER_MEMBER_PATTERN.test(name);

/** The numeric twin of an embedded-data member (`FeedbackRecords.ed_x` → `FeedbackRecords.edn_x`). */
export const toEmbeddedNumberMember = (member: string): string =>
  EMBEDDED_NUMBER_MEMBER_PREFIX + member.slice(EMBEDDED_MEMBER_PREFIX.length);

/** The embedded-data member a numeric twin reads (`FeedbackRecords.edn_x` → `FeedbackRecords.ed_x`). */
export const fromEmbeddedNumberMember = (member: string): string =>
  EMBEDDED_MEMBER_PREFIX + member.slice(EMBEDDED_NUMBER_MEMBER_PREFIX.length);

/**
 * Whether a key can compile at all: a string, not blank (a blank title breaks the whole Cube model), at
 * most `MAX_EMBEDDED_KEY_LENGTH`, no control character and nothing Postgres text cannot hold.
 */
export const isCompilableEmbeddedKey = (key: unknown): key is string =>
  typeof key === "string" &&
  key.trim().length > 0 &&
  key.length <= MAX_EMBEDDED_KEY_LENGTH &&
  !CONTROL_CHARACTER.test(key) &&
  !LONE_SURROGATE.test(key);

/** The UTF-8 bytes a key takes in the token, which is JSON. */
export const getEmbeddedKeyTokenBytes = (key: string): number =>
  Buffer.byteLength(JSON.stringify(key), "utf8");

/**
 * The keys a dataset compiles, from its keys ranked most frequent first: only compilable keys, no
 * duplicate, at most `maxKeys` and `maxBytes` token bytes. Keeps the order it was given.
 */
export const selectEmbeddedKeys = (
  rankedKeys: readonly unknown[],
  {
    maxKeys = MAX_EMBEDDED_KEYS,
    maxBytes = MAX_EMBEDDED_KEYS_BYTES,
  }: { maxKeys?: number; maxBytes?: number } = {}
): string[] => {
  const keys: string[] = [];
  const seen = new Set<string>();
  let bytes = 0;
  for (const key of rankedKeys) {
    if (keys.length >= maxKeys) break;
    if (!isCompilableEmbeddedKey(key) || seen.has(key)) continue;
    const keyBytes = getEmbeddedKeyTokenBytes(key);
    if (bytes + keyBytes > maxBytes) continue;
    bytes += keyBytes;
    seen.add(key);
    keys.push(key);
  }
  return keys;
};

const collectFilterMembers = (filters: unknown, into: Set<string>): void => {
  if (!Array.isArray(filters)) return;
  for (const filter of filters) {
    if (typeof filter !== "object" || filter === null) continue;
    const { member, and, or } = filter as { member?: unknown; and?: unknown; or?: unknown };
    if (typeof member === "string") into.add(member);
    collectFilterMembers(and, into);
    collectFilterMembers(or, into);
  }
};

/**
 * The embedded-data members a chart query names, wherever it names one: measures, dimensions, time
 * dimensions, filters (nested `and`/`or` included) and order. A numeric twin (`edn_`) counts as the member
 * it reads. Filter values are never read, so a value
 * that happens to look like a member name is not mistaken for one. Read defensively: a stored query is
 * JSON and could hold anything.
 */
export const collectEmbeddedMemberNames = (query: unknown): string[] => {
  if (typeof query !== "object" || query === null) return [];
  const { measures, dimensions, timeDimensions, filters, order } = query as Record<string, unknown>;
  const members = new Set<string>();
  for (const list of [measures, dimensions]) {
    if (Array.isArray(list)) list.forEach((name) => typeof name === "string" && members.add(name));
  }
  if (Array.isArray(timeDimensions)) {
    for (const timeDimension of timeDimensions) {
      const dimension = (timeDimension as { dimension?: unknown } | null)?.dimension;
      if (typeof dimension === "string") members.add(dimension);
    }
  }
  collectFilterMembers(filters, members);
  if (Array.isArray(order)) {
    order.forEach((entry) => Array.isArray(entry) && typeof entry[0] === "string" && members.add(entry[0]));
  } else if (typeof order === "object" && order !== null) {
    Object.keys(order).forEach((name) => members.add(name));
  }
  // A numeric twin needs its key in the token like the key's own member does.
  return [
    ...new Set(
      [...members].map((name) => (isEmbeddedNumberMemberName(name) ? fromEmbeddedNumberMember(name) : name))
    ),
  ].filter(isEmbeddedMemberName);
};

/**
 * Embedded data as chart fields (ENG-6893): each Feedback Dataset's most frequent embedded-data keys
 * become `FeedbackRecords.ed_<slug>_<hash>` dimensions in that dataset's Cube model. The key list
 * travels in the Cube token, so this module decides which keys a dataset compiles; docker/cube/cube.js
 * applies the same rules again and must agree with them.
 */

/** Most keys one dataset compiles, the most frequent first. */
export const MAX_EMBEDDED_KEYS = 100;
/** Longest key compiled. A longer one is left out rather than truncated, so a name stays exact. */
export const MAX_EMBEDDED_KEY_LENGTH = 128;
/**
 * Most UTF-8 bytes the keys may take together. They ride in the Cube token, which travels as an HTTP
 * header that Node caps at 16 KiB; base64 and the other claims leave room for about this much. Short,
 * realistic keys never come near it: 100 keys of 60 characters do not.
 */
export const MAX_EMBEDDED_KEYS_BYTES = 8 * 1024;

export const EMBEDDED_MEMBER_PREFIX = "FeedbackRecords.ed_";
const EMBEDDED_MEMBER_PATTERN = /^FeedbackRecords\.ed_[a-z0-9_]+$/;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

export const isEmbeddedMemberName = (name: string): boolean => EMBEDDED_MEMBER_PATTERN.test(name);

/**
 * The keys a dataset compiles, from its keys ranked most frequent first: no blank key (a blank title
 * breaks the whole Cube model), none over `MAX_EMBEDDED_KEY_LENGTH`, none Postgres text cannot hold, no
 * duplicate, at most `MAX_EMBEDDED_KEYS` and `MAX_EMBEDDED_KEYS_BYTES`. Keeps frequency order.
 */
export const selectEmbeddedKeys = (rankedKeys: readonly unknown[]): string[] => {
  const keys: string[] = [];
  const seen = new Set<string>();
  let bytes = 0;
  for (const key of rankedKeys) {
    if (keys.length >= MAX_EMBEDDED_KEYS) break;
    if (typeof key !== "string" || key.trim().length === 0 || key.length > MAX_EMBEDDED_KEY_LENGTH) continue;
    if (key.includes("\u0000") || LONE_SURROGATE.test(key) || seen.has(key)) continue;
    const keyBytes = new TextEncoder().encode(key).length;
    if (bytes + keyBytes > MAX_EMBEDDED_KEYS_BYTES) continue;
    bytes += keyBytes;
    seen.add(key);
    keys.push(key);
  }
  return keys;
};

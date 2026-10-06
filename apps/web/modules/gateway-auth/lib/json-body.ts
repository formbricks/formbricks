/**
 * Parsing for JSON bodies that a gateway authorizer reads and then lets through to an upstream
 * **unchanged**.
 *
 * An authorizer that inspects a body it does not rewrite has to read it exactly the way the upstream
 * will; wherever the two parsers disagree, a caller can show the authorizer one value and the upstream
 * another. `JSON.parse` matches keys exactly and keeps the last of a repeated key. Go's
 * `encoding/json` v1 — which the Hub decoded bodies with until ENG-3658, and which every older Hub
 * release a gateway may still front keeps doing — matches keys case-insensitively (ASCII case, plus
 * the two non-ASCII runes it folds onto ASCII letters, `K` (Kelvin sign → `k`) and `ſ` (long s →
 * `s`)) and also keeps the last. So a body is refused here when its top-level keys could be read
 * more than one way:
 *
 * - a key appears twice (RFC 7493, I-JSON: names MUST be unique). `JSON.parse` and v1 both keep the
 *   last one; a reader that keeps the first would act on a different value.
 * - a key contains a non-ASCII character. No upstream field is non-ASCII, and refusing them means the
 *   case check below never needs Unicode folding tables — Go's today, or a different consumer's
 *   tomorrow.
 *
 * Case variants of a specific key (`TENANT_ID` next to `tenant_id`) are checked by the caller with
 * `hasCaseVariantKey`, because only the caller knows which keys it authorizes on.
 */

export type TGatewayJsonBodyRejectionReason =
  | "invalid_json"
  | "not_object"
  | "duplicate_key"
  | "non_ascii_key";

export type TGatewayJsonObjectParseResult =
  | { ok: true; body: Record<string, unknown>; keys: string[] }
  | { ok: false; reason: TGatewayJsonBodyRejectionReason };

const QUOTE = 0x22; // "
const BACKSLASH = 0x5c; // \
const COMMA = 0x2c; // ,
const OPEN_OBJECT = 0x7b; // {
const CLOSE_OBJECT = 0x7d; // }
const OPEN_ARRAY = 0x5b; // [
const CLOSE_ARRAY = 0x5d; // ]
const MAX_ASCII = 0x7f;

const isAscii = (value: string): boolean => {
  for (let index = 0; index < value.length; index++) {
    if (value.charCodeAt(index) > MAX_ASCII) {
      return false;
    }
  }

  return true;
};

/**
 * Returns the top-level keys of a JSON object text **in source order, duplicates included** —
 * which `JSON.parse` cannot, since it keeps only the last of a repeated key.
 *
 * Precondition: `JSON.parse(json)` has already succeeded and produced a plain object. The scanner
 * relies on that and does not re-validate the grammar; it only tracks string boundaries (with
 * escapes) and nesting depth. It is a single iterative pass, so deeply nested input cannot exhaust
 * the stack. Keys are returned decoded (`"\u0054ENANT_ID"` comes back as `TENANT_ID`).
 */
export const scanTopLevelKeys = (json: string): string[] => {
  const keys: string[] = [];
  let depth = 0;
  // At depth 1, the next string is a key right after the opening `{` or a `,`; otherwise it is a value.
  let expectingKey = false;

  for (let index = 0; index < json.length; index++) {
    const charCode = json.charCodeAt(index);

    if (charCode === QUOTE) {
      const string = readString(json, index);

      // Only ever true at depth 1: it is set by a depth-1 `{` or `,`.
      if (expectingKey) {
        // A key without escapes is exactly its raw text; only an escaped one needs decoding.
        keys.push(
          string.escaped
            ? (JSON.parse(json.slice(index, string.end + 1)) as string)
            : json.slice(index + 1, string.end)
        );
        expectingKey = false;
      }

      index = string.end;
      continue;
    }

    if (charCode === OPEN_OBJECT || charCode === OPEN_ARRAY) {
      depth++;
      expectingKey = depth === 1;
    } else if (charCode === CLOSE_OBJECT || charCode === CLOSE_ARRAY) {
      depth--;
    } else if (charCode === COMMA && depth === 1) {
      expectingKey = true;
    }
  }

  return keys;
};

/**
 * Finds the end of the JSON string that opens at `openQuote`: the index of its closing quote, and
 * whether it holds any escape. An escaped character is skipped, so an escaped quote never ends the
 * string. Bounded by the length too: on input that broke the scanner's precondition, running off the
 * end must stop rather than spin (`charCodeAt` past the end is NaN, never a quote).
 */
const readString = (json: string, openQuote: number): { end: number; escaped: boolean } => {
  let escaped = false;
  let index = openQuote + 1;

  while (index < json.length && json.charCodeAt(index) !== QUOTE) {
    if (json.charCodeAt(index) === BACKSLASH) {
      escaped = true;
      index += 2;
    } else {
      index++;
    }
  }

  if (index >= json.length) {
    throw new SyntaxError("Unterminated string in JSON");
  }

  return { end: index, escaped };
};

/**
 * Parses a request body that must be a JSON object whose top-level keys can only be read one way.
 * See the module comment for what "one way" rules out.
 */
export const parseGatewayJsonObject = (json: string): TGatewayJsonObjectParseResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "not_object" };
  }

  const keys = scanTopLevelKeys(json);
  const seen = new Set<string>();
  for (const key of keys) {
    if (!isAscii(key)) {
      return { ok: false, reason: "non_ascii_key" };
    }
    if (seen.has(key)) {
      return { ok: false, reason: "duplicate_key" };
    }
    seen.add(key);
  }

  return { ok: true, body: parsed as Record<string, unknown>, keys };
};

/**
 * Whether any key other than `canonicalKey` itself is an ASCII case variant of it (`TENANT_ID`,
 * `Tenant_Id` for `tenant_id`). A case-insensitive upstream reads such a key as `canonicalKey`.
 *
 * Only ASCII case is folded: `parseGatewayJsonObject` has already refused every non-ASCII key, which
 * is what makes this complete against `encoding/json` v1's folding.
 */
export const hasCaseVariantKey = (keys: readonly string[], canonicalKey: string): boolean => {
  const canonical = canonicalKey.toLowerCase();
  return keys.some((key) => key !== canonicalKey && key.toLowerCase() === canonical);
};

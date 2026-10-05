/**
 * A pre-parse scan that bounds how deeply the source nests before the native parser sees it.
 *
 * lightningcss parses nested blocks recursively, and around 10,000 levels (`.a{.a{…`, `calc(calc(…`,
 * `:is(:is(…`, all well inside the 100 KB budget) it overflows the native stack and kills the process —
 * not an exception we could catch. So nesting is measured here first, with the tokenizer rules of CSS
 * Syntax Level 3 §4 (https://drafts.csswg.org/css-syntax-3/#tokenization): a bracket only counts where the
 * real tokenizer would see one, so a `{` inside a string, a comment or an unquoted `url(…)` does not, and
 * a comment start inside `url(…)` does not hide the brackets that follow it. Blocks are matched with a
 * stack the way the parser matches them, so a stray `)` cannot cancel a `{`. Counting is never lower
 * than the parser's: wherever this scan is unsure it treats the character as a bracket.
 */

export type TPrescanLimitKind = "nesting" | "function" | "rules";

export type TPrescanResult =
  | { ok: true; blocks: number }
  | { ok: false; kind: TPrescanLimitKind; line: number; column: number };

interface TPrescanLimits {
  maxNestingDepth: number;
  maxFunctionDepth: number;
  maxBlocks: number;
}

/** Where a token ends, and the limit it exceeded if it opened one block too many. */
interface TScanStep {
  end: number;
  failure: TPrescanResult | null;
}

const isNewline = (c: string): boolean => c === "\n";
const isWhitespace = (c: string): boolean => c === " " || c === "\t" || c === "\n";
const isHexDigit = (c: string): boolean => /^[0-9a-fA-F]$/.test(c);
const isDigit = (c: string): boolean => c >= "0" && c <= "9";
// `c` is always one UTF-16 code unit (or "" past the end), so `codePointAt(0)` is that unit's value.
const isIdentStart = (c: string): boolean =>
  (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_" || (c.codePointAt(0) ?? 0) >= 0x80;
const isIdentChar = (c: string): boolean => isIdentStart(c) || isDigit(c) || c === "-";
const isNonPrintable = (c: string): boolean => {
  const code = c.codePointAt(0);
  if (code === undefined) return false;
  return code <= 0x08 || code === 0x0b || (code >= 0x0e && code <= 0x1f) || code === 0x7f;
};

/** The opening bracket each closing bracket matches. */
const OPENING_BRACKETS = new Map([
  ["}", "{"],
  [")", "("],
  ["]", "["],
]);

/** CSS Syntax §3.3 preprocessing: CR LF, CR and FF are newlines; NUL is U+FFFD (an ident code point). */
const preprocess = (source: string): string =>
  source
    .replaceAll("\r\n", "\n")
    .replaceAll(/[\r\f]/g, "\n")
    .replaceAll("\0", "\uFFFD");

/** The code point a hex escape stands for: zero, surrogates and out-of-range values are U+FFFD (§4.3.7). */
const decodeHexEscape = (hex: string): string => {
  const codePoint = Number.parseInt(hex, 16);
  const isValid = codePoint > 0 && codePoint <= 0x10ffff && (codePoint < 0xd800 || codePoint > 0xdfff);
  return String.fromCodePoint(isValid ? codePoint : 0xfffd);
};

/** Line and column (1-based, UTF-16 units like lightningcss) of an index in the preprocessed source. */
const locate = (source: string, index: number): { line: number; column: number } => {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === "\n") {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: index - lineStart + 1 };
};

export const prescanCustomCss = (rawSource: string, limits: TPrescanLimits): TPrescanResult => {
  const s = preprocess(rawSource);
  const n = s.length;
  const stack: string[] = [];
  let braceDepth = 0;
  let functionDepth = 0;
  let blocks = 0;

  const at = (i: number): string => (i < n ? s[i] : "");
  const skipWhitespace = (start: number): number => {
    let i = start;
    while (i < n && isWhitespace(s[i])) i++;
    return i;
  };
  const skipDigits = (start: number): number => {
    let i = start;
    while (i < n && isDigit(s[i])) i++;
    return i;
  };
  /** §4.3.8: a backslash starts an escape unless a newline follows it. */
  const isValidEscape = (i: number): boolean => at(i) === "\\" && at(i + 1) !== "\n";

  /** §4.3.7 consume an escaped code point; `i` is just past the backslash. Returns the next index. */
  const consumeEscape = (i: number): number => {
    if (i >= n) return i;
    if (isHexDigit(s[i])) {
      let j = i;
      while (j < n && j - i < 6 && isHexDigit(s[j])) j++;
      if (j < n && isWhitespace(s[j])) j++;
      return j;
    }
    return i + 1;
  };

  /** §4.3.9: would the code points at `i` start an ident sequence? */
  const startsIdent = (i: number): boolean => {
    const c = at(i);
    if (c === "-") {
      const next = at(i + 1);
      return isIdentStart(next) || next === "-" || isValidEscape(i + 1);
    }
    if (c === "\\") return isValidEscape(i);
    return c !== "" && isIdentStart(c);
  };

  /** §4.3.10: would the code points at `i` start a number? */
  const startsNumber = (i: number): boolean => {
    const c = at(i);
    if (c === "+" || c === "-") {
      return isDigit(at(i + 1)) || (at(i + 1) === "." && isDigit(at(i + 2)));
    }
    if (c === ".") return isDigit(at(i + 1));
    return isDigit(c);
  };

  /** §4.3.11: consume an ident sequence, returning its end and (up to 4 chars of) its decoded name. */
  const consumeIdentSequence = (start: number): { end: number; name: string } => {
    let i = start;
    let name = "";
    while (i < n) {
      const c = s[i];
      if (isIdentChar(c)) {
        if (name.length < 4) name += c;
        i++;
      } else if (isValidEscape(i)) {
        const escapeStart = i + 1;
        i = consumeEscape(escapeStart);
        if (name.length < 4) {
          const raw = s.slice(escapeStart, i).trim();
          name += isHexDigit(raw[0] ?? "") ? decodeHexEscape(raw) : raw;
        }
      } else {
        break;
      }
    }
    return { end: i, name };
  };

  /** §4.3.14: the remnants of a bad url, up to and including `)`. */
  const consumeBadUrlRemnants = (start: number): number => {
    let i = start;
    while (i < n) {
      if (s[i] === ")") return i + 1;
      if (isValidEscape(i)) i = consumeEscape(i + 1);
      else i++;
    }
    return i;
  };

  /** §4.3.6: whitespace inside a url token ends it, so only `)` may follow; anything else is a bad url. */
  const consumeUrlEnd = (start: number): number => {
    const i = skipWhitespace(start);
    if (i >= n || s[i] === ")") return Math.min(i + 1, n);
    return consumeBadUrlRemnants(i);
  };

  /** §4.3.6: an unquoted url token; `start` is just past `url(`. Nothing inside counts as a bracket. */
  const consumeUrl = (start: number): number => {
    let i = skipWhitespace(start);
    while (i < n) {
      const c = s[i];
      if (c === ")") return i + 1;
      if (isWhitespace(c)) return consumeUrlEnd(i);
      if (c === '"' || c === "'" || c === "(" || isNonPrintable(c)) return consumeBadUrlRemnants(i);
      if (c === "\\") {
        if (!isValidEscape(i)) return consumeBadUrlRemnants(i);
        i = consumeEscape(i + 1);
      } else {
        i++;
      }
    }
    return i;
  };

  /** §4.3.5: a string token (a bad string ends before an unescaped newline, which is not consumed). */
  const consumeString = (start: number): number => {
    const quote = s[start];
    let i = start + 1;
    while (i < n) {
      const c = s[i];
      if (c === quote) return i + 1;
      if (isNewline(c)) return i;
      if (c === "\\") {
        if (i + 1 >= n) return n;
        if (isNewline(s[i + 1])) i += 2;
        else i = consumeEscape(i + 1);
        continue;
      }
      i++;
    }
    return i;
  };

  /** §4.3.12 step 5: an exponent at the `e` at `i`, taken only when a digit follows (else `e` starts a unit). */
  const consumeExponent = (i: number): number => {
    const sign = at(i + 1);
    if (isDigit(sign)) return skipDigits(i + 1);
    if ((sign === "+" || sign === "-") && isDigit(at(i + 2))) return skipDigits(i + 2);
    return i;
  };

  /** §4.3.12: a number, followed by a unit or `%` (a unit is never a url). */
  const consumeNumeric = (start: number): number => {
    let i = start;
    if (s[i] === "+" || s[i] === "-") i++;
    i = skipDigits(i);
    if (at(i) === "." && isDigit(at(i + 1))) i = skipDigits(i + 1);
    if (at(i) === "e" || at(i) === "E") i = consumeExponent(i);
    if (startsIdent(i)) return consumeIdentSequence(i).end;
    if (at(i) === "%") return i + 1;
    return i;
  };

  const open = (kind: string, index: number): TPrescanResult | null => {
    stack.push(kind);
    if (kind === "{") {
      braceDepth++;
      blocks++;
      if (braceDepth > limits.maxNestingDepth) return { ok: false, kind: "nesting", ...locate(s, index) };
      if (blocks > limits.maxBlocks) return { ok: false, kind: "rules", ...locate(s, index) };
    } else {
      functionDepth++;
      if (functionDepth > limits.maxFunctionDepth)
        return { ok: false, kind: "function", ...locate(s, index) };
    }
    return null;
  };

  const close = (kind: string): void => {
    if (stack.at(-1) !== kind) return;
    stack.pop();
    if (kind === "{") braceDepth--;
    else functionDepth--;
  };

  /** §4.3.4: an ident, a function or a url. */
  const consumeIdentLike = (start: number): TScanStep => {
    const { end, name } = consumeIdentSequence(start);
    if (at(end) !== "(") return { end, failure: null };
    // An ASCII case-insensitive match only: Unicode lowercasing must never turn a function into a url.
    if (/^[uU][rR][lL]$/.test(name)) {
      let j = end + 1;
      while (isWhitespace(at(j)) && isWhitespace(at(j + 1))) j++;
      const next = isWhitespace(at(j)) ? at(j + 1) : at(j);
      if (next !== '"' && next !== "'") return { end: consumeUrl(end + 1), failure: null };
    }
    return { end: end + 1, failure: open("(", end) };
  };

  /** Comments, whitespace and the `<!--` / `-->` markers: nothing to count. Returns the next index, or null. */
  const skipTrivia = (i: number): number | null => {
    const c = s[i];
    if (c === "/" && at(i + 1) === "*") {
      const commentEnd = s.indexOf("*/", i + 2);
      return commentEnd === -1 ? n : commentEnd + 2;
    }
    if (isWhitespace(c)) return i + 1;
    if (c === "<" && s.startsWith("!--", i + 1)) return i + 4;
    if (c === "-" && !startsNumber(i) && s.startsWith("->", i + 1)) return i + 3;
    return null;
  };

  /**
   * Strings, hashes, at-keywords and numbers: skipped whole, so a bracket inside one is not counted.
   * Returns the next index, or null.
   */
  const skipToken = (i: number): number | null => {
    const c = s[i];
    if (c === '"' || c === "'") return consumeString(i);
    // §4.3.1: a hash token takes any ident code point or escape that follows.
    if (c === "#")
      return isIdentChar(at(i + 1)) || isValidEscape(i + 1) ? consumeIdentSequence(i + 1).end : i + 1;
    if (c === "@") return startsIdent(i + 1) ? consumeIdentSequence(i + 1).end : i + 1;
    if (startsNumber(i)) return consumeNumeric(i);
    return null;
  };

  /** A bracket: an opening one is counted against the limits, a closing one pops its match. Else null. */
  const consumeBracket = (i: number): TScanStep | null => {
    const c = s[i];
    if (c === "{" || c === "(" || c === "[") return { end: i + 1, failure: open(c, i) };
    const opening = OPENING_BRACKETS.get(c);
    if (opening === undefined) return null;
    close(opening);
    return { end: i + 1, failure: null };
  };

  /** The token at `i`. Every character the tokenizer would not start a token with is skipped alone. */
  const consumeToken = (i: number): TScanStep => {
    const skipped = skipTrivia(i) ?? skipToken(i);
    if (skipped !== null) return { end: skipped, failure: null };
    const bracket = consumeBracket(i);
    if (bracket) return bracket;
    if (startsIdent(i)) return consumeIdentLike(i);
    return { end: i + 1, failure: null };
  };

  let i = 0;
  while (i < n) {
    const { end, failure } = consumeToken(i);
    if (failure) return failure;
    i = end;
  }

  return { ok: true, blocks };
};

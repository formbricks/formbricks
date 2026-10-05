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

const isNewline = (c: string): boolean => c === "\n";
const isWhitespace = (c: string): boolean => c === " " || c === "\t" || c === "\n";
const isHexDigit = (c: string): boolean => /^[0-9a-fA-F]$/.test(c);
const isDigit = (c: string): boolean => c >= "0" && c <= "9";
const isIdentStart = (c: string): boolean =>
  (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_" || c.charCodeAt(0) >= 0x80;
const isIdentChar = (c: string): boolean => isIdentStart(c) || isDigit(c) || c === "-";
const isNonPrintable = (c: string): boolean => {
  const code = c.charCodeAt(0);
  return code <= 0x08 || code === 0x0b || (code >= 0x0e && code <= 0x1f) || code === 0x7f;
};

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

  /** §4.3.6: an unquoted url token; `start` is just past `url(`. Nothing inside counts as a bracket. */
  const consumeUrl = (start: number): number => {
    let i = start;
    while (i < n && isWhitespace(s[i])) i++;
    while (i < n) {
      const c = s[i];
      if (c === ")") return i + 1;
      if (isWhitespace(c)) {
        while (i < n && isWhitespace(s[i])) i++;
        if (i >= n || s[i] === ")") return Math.min(i + 1, n);
        return consumeBadUrlRemnants(i);
      }
      if (c === '"' || c === "'" || c === "(" || isNonPrintable(c)) return consumeBadUrlRemnants(i);
      if (c === "\\") {
        if (isValidEscape(i)) i = consumeEscape(i + 1);
        else return consumeBadUrlRemnants(i);
        continue;
      }
      i++;
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

  /** §4.3.12: a number, followed by a unit or `%` (a unit is never a url). */
  const consumeNumeric = (start: number): number => {
    let i = start;
    if (s[i] === "+" || s[i] === "-") i++;
    while (i < n && isDigit(s[i])) i++;
    if (at(i) === "." && isDigit(at(i + 1))) {
      i++;
      while (i < n && isDigit(s[i])) i++;
    }
    const e = at(i);
    if (e === "e" || e === "E") {
      const sign = at(i + 1);
      if (isDigit(sign)) i++;
      else if ((sign === "+" || sign === "-") && isDigit(at(i + 2))) i += 2;
      if (isDigit(at(i))) while (i < n && isDigit(s[i])) i++;
    }
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
    if (stack.length === 0 || stack[stack.length - 1] !== kind) return;
    stack.pop();
    if (kind === "{") braceDepth--;
    else functionDepth--;
  };

  /** §4.3.4: an ident, a function or a url. */
  const consumeIdentLike = (start: number): { end: number; failure: TPrescanResult | null } => {
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

  let i = 0;
  while (i < n) {
    const c = s[i];

    if (c === "/" && at(i + 1) === "*") {
      const commentEnd = s.indexOf("*/", i + 2);
      i = commentEnd === -1 ? n : commentEnd + 2;
      continue;
    }
    if (isWhitespace(c)) {
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      i = consumeString(i);
      continue;
    }
    if (c === "{" || c === "(" || c === "[") {
      const failure = open(c, i);
      if (failure) return failure;
      i++;
      continue;
    }
    if (c === "}" || c === ")" || c === "]") {
      close(c === "}" ? "{" : c === ")" ? "(" : "[");
      i++;
      continue;
    }
    if (c === "#") {
      // §4.3.1: a hash token takes any ident code point or escape that follows.
      i = isIdentChar(at(i + 1)) || isValidEscape(i + 1) ? consumeIdentSequence(i + 1).end : i + 1;
      continue;
    }
    if (c === "@") {
      i = startsIdent(i + 1) ? consumeIdentSequence(i + 1).end : i + 1;
      continue;
    }
    if (c === "<" && s.startsWith("!--", i + 1)) {
      i += 4;
      continue;
    }
    if (c === "-" && !startsNumber(i) && s.startsWith("->", i + 1)) {
      i += 3;
      continue;
    }
    if (startsNumber(i)) {
      i = consumeNumeric(i);
      continue;
    }
    if (startsIdent(i)) {
      const { end, failure } = consumeIdentLike(i);
      if (failure) return failure;
      i = end;
      continue;
    }
    i++;
  }

  return { ok: true, blocks };
};

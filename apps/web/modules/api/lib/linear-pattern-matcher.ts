import "server-only";
import { RE2JS } from "re2js";
import type { TPatternMatcher } from "@formbricks/surveys/validation";

/**
 * Evaluates survey `pattern` rules on the server in linear time.
 *
 * Patterns are written by survey authors and the values are posted by anonymous respondents, so the
 * native backtracking `RegExp` would let a pattern such as `^(a+)+$` block the event loop for minutes
 * on a 40-character answer (ENG-7109). RE2 runs in time linear in the input, whatever the pattern.
 *
 * RE2 has no lookaheads or backreferences. Such a pattern is not evaluated here (the rule passes on
 * the server and is still enforced in the respondent's browser), as an invalid pattern always has been.
 *
 * The server must never be stricter than the browser, or it refuses answers the survey accepted. RE2's
 * `\s` matches ASCII whitespace only, where JavaScript's also matches every Unicode space (a pasted
 * no-break space, for one), so `\s` is rewritten to the JavaScript set. The other differences make RE2
 * more lenient (its `.` also matches CR, U+2028 and U+2029; its `\S` covers more), except two:
 * - without the `u` flag JavaScript counts a character outside the BMP (an emoji) as two, RE2 as one,
 *   so `^.{10,}$` accepts five emoji in the browser and refuses them here;
 * - with `i`, a few letters whose case pairs are newer than re2js's Unicode tables (U+0277/U+A7DD,
 *   U+027C/U+A7E2, U+AB4B/U+AB6C and a few more) match their pair only in the browser.
 */

// ECMAScript `\s`: WhiteSpace and LineTerminator (ECMA-262 §22.2.2.9, CharacterClassEscape).
const JS_WHITESPACE_CLASS_BODY = String.raw`\x{9}-\x{D}\x{20}\x{A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}`;

interface Token {
  /** What the token becomes in the rewritten pattern. */
  text: string;
  /** How many characters of the source it consumes. */
  length: number;
  /** Whether the next token is inside a bracket expression. */
  inClass: boolean;
}

/** `\s` becomes JavaScript's whitespace set; every other escape is kept as written. */
const readEscape = (next: string | undefined, inClass: boolean): Token => {
  if (next !== "s") return { text: `\\${next ?? ""}`, length: 2, inClass };
  return {
    text: inClass ? JS_WHITESPACE_CLASS_BODY : `[${JS_WHITESPACE_CLASS_BODY}]`,
    length: 2,
    inClass,
  };
};

/** `[`, an optional `^`, and a `]` straight after them, which RE2 reads as a literal. */
const readClassOpening = (source: string, start: number): Token => {
  let end = start + 1;
  if (source[end] === "^") end++;
  if (source[end] === "]") end++;
  return { text: source.slice(start, end), length: end - start, inClass: true };
};

/** Inside a bracket expression: a POSIX class such as `[:alpha:]` ends in its own `]`. */
const readInClass = (source: string, start: number): Token => {
  if (source.startsWith("[:", start)) {
    const end = source.indexOf(":]", start + 2);
    if (end !== -1) return { text: source.slice(start, end + 2), length: end + 2 - start, inClass: true };
  }
  const char = source[start];
  return { text: char, length: 1, inClass: char !== "]" };
};

const readToken = (source: string, start: number, inClass: boolean): Token => {
  const char = source[start];
  if (char === "\\") return readEscape(source[start + 1], inClass);
  if (inClass) return readInClass(source, start);
  if (char === "[") return readClassOpening(source, start);
  return { text: char, length: 1, inClass: false };
};

/** Rewrites every `\s` in an RE2 pattern to JavaScript's whitespace set, inside and outside classes. */
const withJavaScriptWhitespace = (source: string): string => {
  let out = "";
  let inClass = false;
  let position = 0;

  while (position < source.length) {
    const token = readToken(source, position, inClass);
    out += token.text;
    inClass = token.inClass;
    position += token.length;
  }

  return out;
};

const compile = (pattern: string, flags: string | undefined): RE2JS | null => {
  let native: RegExp;
  try {
    // Parses (does not run) the pattern, so it is refused exactly where the browser refuses it.
    native = new RegExp(pattern, flags);
  } catch {
    return null;
  }

  try {
    return RE2JS.compile(withJavaScriptWhitespace(RE2JS.translateRegExp(native)), RE2JS.LOOKBEHINDS);
  } catch {
    return null;
  }
};

// Compiling is the expensive step and a survey's patterns repeat on every response. Bounded, oldest
// entry evicted first; `null` caches "cannot be evaluated" too.
const MAX_CACHED_PATTERNS = 256;
const compiled = new Map<string, RE2JS | null>();

const getCompiled = (pattern: string, flags: string | undefined): RE2JS | null => {
  const key = `${flags ?? ""}/${pattern}`;
  const cached = compiled.get(key);
  if (cached !== undefined) return cached;

  const result = compile(pattern, flags);
  if (compiled.size >= MAX_CACHED_PATTERNS) {
    compiled.delete(compiled.keys().next().value as string);
  }
  compiled.set(key, result);
  return result;
};

export const matchPatternInLinearTime: TPatternMatcher = (pattern, flags, value) =>
  getCompiled(pattern, flags)?.test(value);

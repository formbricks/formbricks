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
 * Linear is not cheap: the work is the compiled program's size times the answer's length, and a
 * 500-character pattern can compile to tens of thousands of instructions. So programs past
 * `MAX_PROGRAM_SIZE` are not run, each validation run gets a work budget (`createLinearPatternMatcher`),
 * lookbehinds (re2js runs them on its slow engine) are not enabled, and no compiled program outlives
 * its run.
 *
 * A pattern RE2 cannot run the way JavaScript would (lookarounds, backreferences, escapes the two read
 * differently), or not cheaply, is not evaluated here: the rule passes on the server and is still
 * enforced in the respondent's browser, as an invalid pattern always has been.
 *
 * The server must never be stricter than the browser, or it refuses answers the survey accepted. RE2's
 * `\s` and `\S` split whitespace at ASCII, JavaScript's at every Unicode space (a pasted no-break
 * space, for one), so both are rewritten to the JavaScript sets; with `m`, RE2's `^` and `$` see only
 * `\n` as a line break, so such a pattern is not evaluated against an answer holding another one. The
 * remaining differences make RE2 more lenient (its `.` also matches CR, U+2028 and U+2029), except two:
 * - without the `u` flag JavaScript counts a character outside the BMP (an emoji) as two, RE2 as one,
 *   so `^.{10,}$` accepts five emoji in the browser and refuses them here;
 * - with `i`, a few letters whose case pairs are newer than re2js's Unicode tables (U+0277/U+A7DD,
 *   U+027C/U+A7E2, U+AB4B/U+AB6C and a few more) match their pair only in the browser.
 */

// ECMAScript `\s`: WhiteSpace and LineTerminator (ECMA-262 §22.2.2.9, CharacterClassEscape), and its
// complement for `\S`, spelled as ranges so it also works inside a bracket expression.
const JS_WHITESPACE_CLASS_BODY = String.raw`\x{9}-\x{D}\x{20}\x{A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}`;
const JS_NON_WHITESPACE_CLASS_BODY = String.raw`\x{0}-\x{8}\x{E}-\x{1F}\x{21}-\x{9F}\x{A1}-\x{167F}\x{1681}-\x{1FFF}\x{200B}-\x{2027}\x{202A}-\x{202E}\x{2030}-\x{205E}\x{2060}-\x{2FFF}\x{3001}-\x{FEFE}\x{FF00}-\x{10FFFF}`;
const JS_CLASS_BODIES: Record<string, string> = {
  s: JS_WHITESPACE_CLASS_BODY,
  S: JS_NON_WHITESPACE_CLASS_BODY,
};

interface Token {
  /** What the token becomes in the rewritten pattern. */
  text: string;
  /** How many characters of the source it consumes. */
  length: number;
  /** Whether the next token is inside a bracket expression. */
  inClass: boolean;
}

/** `\s` and `\S` become JavaScript's sets; every other escape is kept as written. */
const readEscape = (next: string | undefined, inClass: boolean): Token => {
  const body = next === undefined ? undefined : JS_CLASS_BODIES[next];
  if (body === undefined) return { text: `\\${next ?? ""}`, length: 2, inClass };
  return { text: inClass ? body : `[${body}]`, length: 2, inClass };
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

/** Rewrites every `\s` and `\S` in an RE2 pattern to JavaScript's sets, inside and outside classes. */
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

// Escapes RE2 would read differently from JavaScript. `\k<name>` is a backreference, which RE2 lacks
// (and re2js translates into the literal "k<name>"). Without `u`, JavaScript reads `\a`, `\A`, `\z`,
// `\Q`, `\E`, `\C`, `\p` and `\P` as the plain letter; RE2 gives each a meaning of its own.
const BACKREFERENCE_ESCAPES = new Set(["k"]);
const NON_UNICODE_DIVERGENT_ESCAPES = new Set(["k", "a", "A", "z", "Q", "E", "C", "p", "P"]);

const hasDivergentEscape = (pattern: string, unicode: boolean): boolean => {
  const divergent = unicode ? BACKREFERENCE_ESCAPES : NON_UNICODE_DIVERGENT_ESCAPES;
  for (let i = pattern.indexOf("\\"); i !== -1; i = pattern.indexOf("\\", i + 2)) {
    if (divergent.has(pattern[i + 1])) return true;
  }
  return false;
};

/**
 * Largest compiled program evaluated here. Real patterns compile to tens of instructions (an email
 * pattern is 12; `^.{1,1000}$` about 2,000), while 500 characters of counted repetition reach 70,000,
 * take ~60 ms to compile and up to a second to run on a 4,096-character answer.
 */
export const MAX_PROGRAM_SIZE = 2_500;

/**
 * Work one validation run (one response) may spend on patterns. Running a program costs its size
 * times the answer's length; compiling costs about `COMPILE_COST_PER_INSTRUCTION` per instruction.
 * 10M units is well under ~100 ms; a real survey's patterns, answered at full length, use a few
 * thousand each.
 */
export const MAX_PATTERN_WORK_PER_RUN = 10_000_000;
const COMPILE_COST_PER_INSTRUCTION = 150;

type TCompiled = { program: RE2JS; cost: number } | { program: null; cost: number };

const compile = (pattern: string, flags: string | undefined): TCompiled => {
  let native: RegExp;
  try {
    // Parses (does not run) the pattern, so it is refused exactly where the browser refuses it.
    native = new RegExp(pattern, flags);
  } catch {
    return { program: null, cost: 0 };
  }

  if (hasDivergentEscape(pattern, native.unicode || (flags ?? "").includes("v"))) {
    return { program: null, cost: 0 };
  }

  let program: RE2JS;
  try {
    program = RE2JS.compile(withJavaScriptWhitespace(RE2JS.translateRegExp(native)));
  } catch {
    return { program: null, cost: 0 };
  }

  const cost = program.programSize() * COMPILE_COST_PER_INSTRUCTION;
  return program.programSize() > MAX_PROGRAM_SIZE ? { program: null, cost } : { program, cost };
};

// Patterns that cannot be evaluated, remembered so a survey's oversized pattern is compiled once per
// process rather than on every response. Compiled programs themselves are never kept: re2js grows a
// DFA cache of up to a few MB on each one it runs, so retaining them would let one survey's patterns
// hold gigabytes.
const MAX_REMEMBERED_UNEVALUABLE = 1024;
const unevaluable = new Set<string>();

const rememberUnevaluable = (key: string): void => {
  if (unevaluable.size >= MAX_REMEMBERED_UNEVALUABLE) {
    unevaluable.delete(unevaluable.values().next().value as string);
  }
  unevaluable.add(key);
};

// With `m`, JavaScript's `^` and `$` also break lines at CR, U+2028 and U+2029; RE2's only at `\n`.
const NON_NEWLINE_LINE_BREAK = /[\r\u2028\u2029]/;

/**
 * A matcher for one validation run (one response). Once the run has spent `budget`, further rules are
 * refused rather than run: the response is rejected instead of the server stalling.
 */
export const createLinearPatternMatcher = (budget: number = MAX_PATTERN_WORK_PER_RUN): TPatternMatcher => {
  let spent = 0;

  return (pattern, flags, value) => {
    const key = `${flags ?? ""}/${pattern}`;
    if (unevaluable.has(key)) return undefined;
    if (flags?.includes("m") && NON_NEWLINE_LINE_BREAK.test(value)) return undefined;
    if (spent > budget) return false;

    const { program, cost } = compile(pattern, flags);
    spent += cost;
    if (!program) {
      rememberUnevaluable(key);
      return undefined;
    }

    spent += program.programSize() * Math.max(value.length, 1);
    if (spent > budget) return false;

    return program.test(value);
  };
};

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
 * differently, the `v` flag's set syntax), or not cheaply, is not evaluated here: the rule passes on the server and is still
 * enforced in the respondent's browser, as an invalid pattern always has been.
 *
 * The server must never be stricter than the browser, or it refuses answers the survey accepted. So the
 * pattern is rewritten where RE2 reads it differently:
 * - RE2's `\s` and `\S` split whitespace at ASCII, JavaScript's at every Unicode space (a pasted
 *   no-break space, for one), so both become the JavaScript sets;
 * - without `u`, JavaScript matches UTF-16 code units, so an emoji is two characters (`^.{2}$` accepts
 *   one). RE2 matches code points, so each surrogate code unit is handed to it as a stand-in code point
 *   of its own, in the answer and in the pattern alike;
 * - with `m`, RE2's `^` and `$` see only `\n` as a line break, so such a pattern is not evaluated
 *   against an answer holding CR, U+2028 or U+2029.
 * What remains makes RE2 more lenient (its `.` also matches CR, U+2028 and U+2029), except with `i` for a
 * few letters whose case pairs are newer than re2js's Unicode tables (U+0277/U+A7DD, U+027C/U+A7E2,
 * U+AB4B/U+AB6C and a few more), which match their pair only in the browser.
 */

// ECMAScript `\s`: WhiteSpace and LineTerminator (ECMA-262 §22.2.2.9, CharacterClassEscape), and its
// complement for `\S`, spelled as ranges so it also works inside a bracket expression. The complement
// covers the surrogate stand-ins below, as JavaScript's `\S` covers a lone surrogate.
const JS_WHITESPACE_CLASS_BODY = String.raw`\x{9}-\x{D}\x{20}\x{A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}`;
const JS_NON_WHITESPACE_CLASS_BODY = String.raw`\x{0}-\x{8}\x{E}-\x{1F}\x{21}-\x{9F}\x{A1}-\x{167F}\x{1681}-\x{1FFF}\x{200B}-\x{2027}\x{202A}-\x{202E}\x{2030}-\x{205E}\x{2060}-\x{2FFF}\x{3001}-\x{FEFE}\x{FF00}-\x{10FFFF}`;
const JS_CLASS_BODIES: Record<string, string> = {
  s: JS_WHITESPACE_CLASS_BODY,
  S: JS_NON_WHITESPACE_CLASS_BODY,
};

// Each UTF-16 surrogate code unit maps to its own code point in Supplementary Private Use Area-A. Once
// every surrogate in the answer is replaced, no character there can be one of these, so they never
// collide with real input.
const SURROGATE_FIRST = 0xd800;
const SURROGATE_LAST = 0xdfff;
const SURROGATE_STAND_IN = 0xf0000;
const SURROGATE_CODE_UNIT = /[\uD800-\uDFFF]/g;

const isSurrogate = (codeUnit: number): boolean => codeUnit >= SURROGATE_FIRST && codeUnit <= SURROGATE_LAST;
const standIn = (codeUnit: number): number => SURROGATE_STAND_IN + codeUnit - SURROGATE_FIRST;

/** The answer as RE2 should see it under JavaScript's code-unit matching. */
const withSurrogateStandIns = (value: string): string =>
  value.replace(SURROGATE_CODE_UNIT, (unit) => String.fromCodePoint(standIn(unit.charCodeAt(0))));

const escapeCodePoint = (codePoint: number): string => `\\x{${codePoint.toString(16).toUpperCase()}}`;

/** One character of an RE2 pattern, and the code point it stands for when it is a single one. */
interface Atom {
  text: string;
  length: number;
  codePoint?: number;
}

// `\0` is NUL in both engines; `hasDivergentEscape` refuses it when another digit follows.
const CONTROL_ESCAPES: Record<string, number> = { "0": 0x0, t: 0x9, n: 0xa, v: 0xb, f: 0xc, r: 0xd };
const HEX_ESCAPE = /^\\x(?:\{([0-9A-Fa-f]{1,6})\}|([0-9A-Fa-f]{2}))/;

const readAtom = (source: string, start: number): Atom => {
  const char = source[start];
  if (char !== "\\") return { text: char, length: 1, codePoint: char.charCodeAt(0) };

  const next = source[start + 1] ?? "";
  const hex = next === "x" ? HEX_ESCAPE.exec(source.slice(start, start + 12)) : null;
  if (hex) return { text: hex[0], length: hex[0].length, codePoint: Number.parseInt(hex[1] ?? hex[2], 16) };
  if (next in CONTROL_ESCAPES) return { text: `\\${next}`, length: 2, codePoint: CONTROL_ESCAPES[next] };
  // An escaped punctuation character (`\.`, `\-`, `\]`, `\\`) is that character; a letter is a class.
  if (next && !/[0-9A-Za-z]/.test(next))
    return { text: `\\${next}`, length: 2, codePoint: next.charCodeAt(0) };
  return { text: `\\${next}`, length: 2 };
};

const renderAtom = (atom: Atom, codeUnits: boolean): string =>
  codeUnits && atom.codePoint !== undefined && isSurrogate(atom.codePoint)
    ? escapeCodePoint(standIn(atom.codePoint))
    : atom.text;

const renderRange = (from: number, to: number): string =>
  from === to ? escapeCodePoint(from) : `${escapeCodePoint(from)}-${escapeCodePoint(to)}`;

/** A class range; under code-unit matching, the part inside the surrogate block maps to stand-ins. */
const renderClassRange = (first: Atom, last: Atom, codeUnits: boolean): string => {
  const from = first.codePoint as number;
  const to = last.codePoint as number;
  if (!codeUnits || to < SURROGATE_FIRST || from > SURROGATE_LAST) return `${first.text}-${last.text}`;

  let out = "";
  if (from < SURROGATE_FIRST) out += renderRange(from, SURROGATE_FIRST - 1);
  if (to > SURROGATE_LAST) out += renderRange(SURROGATE_LAST + 1, to);
  out += renderRange(standIn(Math.max(from, SURROGATE_FIRST)), standIn(Math.min(to, SURROGATE_LAST)));
  return out;
};

interface Token {
  /** What the token becomes in the rewritten pattern. */
  text: string;
  /** How many characters of the source it consumes. */
  length: number;
  /** Whether the next token is inside a bracket expression. */
  inClass: boolean;
}

/** `[`, an optional `^`, and a `]` straight after them, which RE2 reads as a literal. */
const readClassOpening = (source: string, start: number): Token => {
  let end = start + 1;
  if (source[end] === "^") end++;
  if (source[end] === "]") end++;
  return { text: source.slice(start, end), length: end - start, inClass: true };
};

/**
 * Inside a bracket expression. A `[` there is a literal in JavaScript (outside `v` mode), but RE2 would
 * read `[:alpha:]` as a POSIX class, so it is escaped.
 */
const readInClass = (source: string, start: number, codeUnits: boolean): Token => {
  if (source[start] === "]") return { text: "]", length: 1, inClass: false };
  if (source[start] === "[") return { text: "\\[", length: 1, inClass: true };

  const first = readAtom(source, start);
  const dash = start + first.length;
  if (first.codePoint !== undefined && source[dash] === "-" && source[dash + 1] !== "]") {
    const last = readAtom(source, dash + 1);
    if (last.codePoint !== undefined) {
      return {
        text: renderClassRange(first, last, codeUnits),
        length: first.length + 1 + last.length,
        inClass: true,
      };
    }
  }
  return { text: renderAtom(first, codeUnits), length: first.length, inClass: true };
};

const readToken = (source: string, start: number, inClass: boolean, codeUnits: boolean): Token => {
  const body = source[start] === "\\" ? JS_CLASS_BODIES[source[start + 1]] : undefined;
  if (body !== undefined) return { text: inClass ? body : `[${body}]`, length: 2, inClass };
  if (inClass) return readInClass(source, start, codeUnits);
  if (source[start] === "[") return readClassOpening(source, start);

  const atom = readAtom(source, start);
  return { text: renderAtom(atom, codeUnits), length: atom.length, inClass: false };
};

/**
 * Rewrites an RE2 pattern to JavaScript's `\s` and `\S`, inside and outside classes, and, when
 * `codeUnits` (no `u` flag), each surrogate to its stand-in.
 */
const toJavaScriptSemantics = (source: string, codeUnits: boolean): string => {
  let out = "";
  let inClass = false;
  let position = 0;

  while (position < source.length) {
    const token = readToken(source, position, inClass, codeUnits);
    out += token.text;
    inClass = token.inClass;
    position += token.length;
  }

  return out;
};

const isUnicodeAware = (flags: string | undefined): boolean => /[uv]/.test(flags ?? "");

// Escapes RE2 would read differently from JavaScript. `\k<name>` is a backreference, which RE2 lacks
// (and re2js translates into the literal "k<name>"). Without `u`, JavaScript reads `\a`, `\A`, `\z`,
// `\Q`, `\E`, `\C`, `\p` and `\P` as the plain letter and `\u{41}` as "u" repeated 41 times; RE2
// gives each a meaning of its own. A digit after `\` is a backreference or a legacy octal escape in
// JavaScript, whose rules RE2's octal escapes do not follow; only a lone `\0` (NUL) means the same.
const BACKREFERENCE_ESCAPES = new Set(["k"]);
const NON_UNICODE_DIVERGENT_ESCAPES = new Set(["k", "a", "A", "z", "Q", "E", "C", "p", "P"]);
const DIGIT = /[0-9]/;

const isDivergentEscape = (pattern: string, at: number, unicode: boolean): boolean => {
  const next = pattern[at + 1] ?? "";
  if ((unicode ? BACKREFERENCE_ESCAPES : NON_UNICODE_DIVERGENT_ESCAPES).has(next)) return true;
  if (!unicode && next === "u" && pattern[at + 2] === "{") return true;
  return DIGIT.test(next) && (next !== "0" || DIGIT.test(pattern[at + 2] ?? ""));
};

const hasDivergentEscape = (pattern: string, unicode: boolean): boolean => {
  for (let i = pattern.indexOf("\\"); i !== -1; i = pattern.indexOf("\\", i + 2)) {
    if (isDivergentEscape(pattern, i, unicode)) return true;
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

  // `v` adds nested classes and set operations, which the rewrite below does not read.
  if (native.unicodeSets) return { program: null, cost: 0 };

  const unicode = isUnicodeAware(flags);
  if (hasDivergentEscape(pattern, unicode)) {
    return { program: null, cost: 0 };
  }

  let program: RE2JS;
  try {
    program = RE2JS.compile(toJavaScriptSemantics(RE2JS.translateRegExp(native), !unicode));
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

    return program.test(isUnicodeAware(flags) ? value : withSurrogateStandIns(value));
  };
};

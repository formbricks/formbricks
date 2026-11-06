/**
 * A file name a user gave, made safe to show. The name stays readable: only what is not text, or what
 * makes text read as something else, is removed. Download names build on it in `content-disposition.ts`.
 */

// C0 and C1 controls, and the bidirectional marks and overrides that can make `exe.json` read as
// `nosj.exe`. Whitespace controls are turned into spaces first, so a tab still separates words.
const CONTROL_CHARACTERS = /[\p{Cc}\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu;
const WHITESPACE_CONTROLS = /[\t\n\v\f\r\u0085\u2028\u2029]/g;
// A lone surrogate is not text and would make `encodeURIComponent` throw.
const LONE_SURROGATES = /\p{Cs}/gu;

/**
 * `name` without lone surrogates, control characters or bidirectional marks, in NFC, with each run of
 * whitespace collapsed to one space and the ends trimmed. Empty when nothing readable is left, so the
 * caller decides what stands in for it.
 */
export const toDisplayFileName = (name: string): string =>
  name
    .replaceAll(LONE_SURROGATES, "")
    .normalize("NFC")
    .replaceAll(WHITESPACE_CONTROLS, " ")
    .replaceAll(CONTROL_CHARACTERS, "")
    .replaceAll(/\s+/g, " ")
    .trim();

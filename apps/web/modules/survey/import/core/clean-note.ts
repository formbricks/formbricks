/**
 * Free text from an AI plan — a note on a logic rule, why a question was skipped — made safe for a
 * report line, for every lane (ENG-3479). The dialog renders it as plain text as well; this is so a line
 * never carries a link at all.
 */
import { SURVEY_IMPORT_MAX_NOTE_CHARS } from "../limits";

// Control characters and the bidi overrides, which can make a report line read as something else.
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;
/**
 * Top-level domains common enough that a bare `name.tld` in a note is taken for a link. Two-letter ones
 * that are English words (`it`, `in`, `at`, `me`, `us`, `is`, `to`, `no`, `be`, `do`, `so`, …) are
 * left out: "selected.It then skips" is a missing space, not a link. Those still count with a path,
 * port, `@` or `www.` (`evil.it/x`).
 */
const COMMON_TLDS = [
  "com",
  "net",
  "org",
  "io",
  "co",
  "info",
  "biz",
  "app",
  "dev",
  "xyz",
  "ai",
  "ly",
  "gg",
  "tk",
  "top",
  "site",
  "online",
  "shop",
  "link",
  "click",
  "live",
  "store",
  "eu",
  "uk",
  "de",
  "fr",
  "nl",
  "ch",
  "es",
  "ru",
  "cn",
  "jp",
  "br",
  "au",
  "ca",
].join("|");
/**
 * A host name: up to ten dot-ended labels, then a top-level domain. The label count is bounded so a
 * long dotted run (`a.a.a.…`) costs a bounded amount of work from each position, not a scan of the rest
 * of the run — with an unbounded `+`, 1,200 characters of it took about 6 ms a note. A longer host is
 * still caught: the match starts at a later label.
 */
const DOTTED_NAME = String.raw`(?:[a-z0-9-]{1,63}\.){1,10}[a-z]{2,24}`;

/**
 * Anything that looks like a link. A dotted word counts as a domain only with a sign it is one — a
 * path, a port, an `@` before it, or a common top-level domain — so `Node.js` or `answer.Then` stay
 * prose while `evil.com/login`, `evil.io:8080` and `user@evil.co` do not. Every quantifier is bounded or
 * consumes a run nothing after it can give back, so the scan is linear in the note.
 */
export const SURVEY_IMPORT_NOTE_URL_PATTERN = new RegExp(
  [
    String.raw`\b(?:[a-z][a-z0-9+.-]{1,20}:\/\/|(?:javascript|data|vbscript|mailto):|www\.)\S*`,
    String.raw`[\w.+-]{0,64}@${DOTTED_NAME}\b\S*`,
    String.raw`\b${DOTTED_NAME}(?::\d{1,5})?\/\S*`,
    String.raw`\b${DOTTED_NAME}:\d{1,5}\b`,
    String.raw`\b(?:[a-z0-9-]{1,63}\.){1,10}(?:${COMMON_TLDS})\b`,
  ].join("|"),
  "gi"
);

/**
 * Free text from the AI, made safe for a report line: control characters gone, anything that looks
 * like a link replaced by `…`, markup characters dropped, whitespace collapsed, capped. The dialog
 * renders it as plain text as well; this is so a line never carries a link at all.
 */
export function cleanNote(raw: string): string {
  const cleaned = raw
    .slice(0, SURVEY_IMPORT_MAX_NOTE_CHARS * 4)
    .replaceAll(CONTROL_CHARACTERS, " ")
    .replaceAll(SURVEY_IMPORT_NOTE_URL_PATTERN, "…")
    .replaceAll(/[<>]/g, "")
    .replaceAll(/\s+/g, " ")
    .trim();
  return cleaned.length > SURVEY_IMPORT_MAX_NOTE_CHARS
    ? `${cleaned.slice(0, SURVEY_IMPORT_MAX_NOTE_CHARS - 1)}…`
    : cleaned;
}

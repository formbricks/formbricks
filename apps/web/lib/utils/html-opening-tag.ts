/**
 * Locate HTML opening tags the way `/<tag\b[^>]*>/gi` did, without the regex.
 *
 * Why not the regex: `[^>]*` is unbounded, so on a run of `<p` with no `>` after it the engine
 * rescans to the end of the document from every occurrence — O(N^2), measured 7.4s on 200k
 * characters. Capping the run is not a fix either: when the over-long run itself contains another
 * `<p`, the engine restarts there and normalizes a DIFFERENT tag, which is a wrong-output failure
 * rather than a no-op.
 *
 * A forward scan has neither problem. `[^>]*` cannot cross a `>`, so a tag always ends at the first
 * `>` after its name — one `indexOf` — and if no `>` follows the first opening tag then none follows
 * a later one either, so the scan stops rather than retrying. Same matches, one pass, no cap.
 */

/** `\b` after an ASCII-letter tag name: the next character must exist and not be a word character. */
const isWordCharacterCode = (code: number): boolean =>
  (code >= 48 && code <= 57) || // 0-9
  (code >= 65 && code <= 90) || // A-Z
  (code >= 97 && code <= 122) || // a-z
  code === 95; // _

const toAsciiLowerCode = (code: number): number => (code >= 65 && code <= 90 ? code + 32 : code);

/**
 * ASCII-case-insensitive `indexOf`, matching the `i` flag's behaviour on the ASCII literals used
 * here. Deliberately not `haystack.toLowerCase().indexOf(...)`: lowercasing is not length-preserving
 * (U+0130 becomes two code units), so a document containing one would misalign every later index.
 */
const indexOfAsciiCaseInsensitive = (haystack: string, needle: string, from: number): number => {
  const lastStart = haystack.length - needle.length;
  for (let start = Math.max(0, from); start <= lastStart; start++) {
    let offset = 0;
    while (
      offset < needle.length &&
      toAsciiLowerCode(haystack.charCodeAt(start + offset)) === toAsciiLowerCode(needle.charCodeAt(offset))
    ) {
      offset++;
    }
    if (offset === needle.length) return start;
  }
  return -1;
};

export interface OpeningTagMatch {
  /** Index of the `<`. */
  readonly index: number;
  /** Length of the whole tag, `<` through `>`. */
  readonly length: number;
  /** Everything between the tag name and the `>` — the regex's capture group. */
  readonly attributes: string;
}

/**
 * The first `<name …>` at or after `from`, or null when there is none.
 *
 * `requireWordBoundary` mirrors whether the pattern had `\b` after the name: `<p\b` must not match
 * `<pre`, while `<!DOCTYPE[^>]*>` has no such constraint and matches `<!DOCTYPEhtml>`.
 */
export const findOpeningTag = (
  source: string,
  name: string,
  { requireWordBoundary = true }: { requireWordBoundary?: boolean } = {},
  from = 0
): OpeningTagMatch | null => {
  const prefix = `<${name}`;
  let searchFrom = from;

  while (searchFrom <= source.length) {
    const start = indexOfAsciiCaseInsensitive(source, prefix, searchFrom);
    if (start === -1) return null;

    const afterPrefix = start + prefix.length;
    // `\b` fails when the next character continues the word, e.g. `<p` inside `<pre>`. The regex
    // would then retry one position later, so the scan does too.
    if (requireWordBoundary && isWordCharacterCode(source.charCodeAt(afterPrefix))) {
      searchFrom = start + 1;
      continue;
    }

    const close = source.indexOf(">", afterPrefix);
    // `[^>]*` cannot cross a `>`, so a tag ends at the first one. No `>` after this opening tag
    // means none after any later one either — the regex would scan the rest of the document to
    // discover that; there is nothing left to find.
    if (close === -1) return null;

    return {
      index: start,
      length: close - start + 1,
      attributes: source.slice(afterPrefix, close),
    };
  }

  return null;
};

/**
 * Index of the first `</name>` at or after `from`, or -1. The counterpart to `findOpeningTag`, and
 * case-insensitive the same way.
 */
export const findClosingTag = (source: string, name: string, from = 0): number =>
  indexOfAsciiCaseInsensitive(source, `</${name}>`, from);

/**
 * Replace every `<name …>` with `replace(attributes, tag)`, matching `/<name\b([^>]*)>/gi` under
 * `replaceAll`. Like the regex, scanning resumes after the replaced tag's `>`, so a replacement
 * that itself contains a tag is never rescanned.
 *
 * `tag` is the matched text exactly as it appeared, which callers that pass a tag through unchanged
 * need: rebuilding it from `name` would normalize `<LI …>` to `<li …>`.
 */
export const replaceOpeningTags = (
  source: string,
  name: string,
  replace: (attributes: string, tag: string) => string,
  options: { requireWordBoundary?: boolean } = {}
): string => {
  let result = "";
  let copiedTo = 0;

  for (
    let match = findOpeningTag(source, name, options, 0);
    match !== null;
    match = findOpeningTag(source, name, options, copiedTo)
  ) {
    const tag = source.slice(match.index, match.index + match.length);
    result += source.slice(copiedTo, match.index) + replace(match.attributes, tag);
    copiedTo = match.index + match.length;
  }

  return copiedTo === 0 ? source : result + source.slice(copiedTo);
};

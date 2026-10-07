import { MAX_BROWSER_LANGUAGE_CANDIDATES } from "@formbricks/i18n-utils/survey-language-match";

/**
 * Parsing for the `Accept-Language` request header (RFC 9110 §12.5.4).
 *
 * The header is client-controlled, so the parser is defensive: it reads a bounded prefix, a bounded
 * number of entries, drops anything that is not a plausible language tag, and never throws.
 */

/** Longer headers are cut here; real browsers send well under 200 characters. */
const MAX_HEADER_LENGTH = 1024;
/** Entries read from the header before sorting. */
const MAX_PARSED_ENTRIES = 32;

// A BCP-47-shaped tag: a 1-8 letter primary subtag, then 1-8 alphanumeric subtags. `_` is tolerated
// as a separator because some clients send it, and the survey language matcher treats it as `-`.
const LANGUAGE_TAG_PATTERN = /^[a-z]{1,8}(?:[-_][a-z0-9]{1,8})*$/i;
// RFC 9110 qvalue: 0 to 1 with at most three decimals.
const QUALITY_PATTERN = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;

interface TWeightedTag {
  tag: string;
  quality: number;
  position: number;
}

/** Returns the entry's weight, 1 when it carries none, or null when the `q` parameter is malformed. */
const parseQuality = (parameters: string[]): number | null => {
  for (const parameter of parameters) {
    const [name, value] = parameter.split("=").map((part) => part.trim());
    if (name.toLowerCase() !== "q") continue;
    if (value === undefined || !QUALITY_PATTERN.test(value)) return null;
    return Number(value);
  }
  return 1;
};

const parseEntry = (entry: string, position: number): TWeightedTag | null => {
  const [rawTag, ...parameters] = entry.split(";");
  const tag = rawTag.trim();
  // `*` means "any language", which says nothing a survey could match on.
  if (!tag || tag === "*" || !LANGUAGE_TAG_PATTERN.test(tag)) return null;

  const quality = parseQuality(parameters);
  // q=0 means "not acceptable", and a malformed weight makes the whole entry untrustworthy.
  if (quality === null || quality === 0) return null;

  return { tag, quality, position };
};

/**
 * The language tags of an `Accept-Language` header, most preferred first: ordered by `q` weight,
 * header order breaking ties, deduplicated case-insensitively, `*` and malformed entries dropped, and
 * capped at {@link MAX_BROWSER_LANGUAGE_CANDIDATES}.
 *
 * @example parseAcceptLanguage("en;q=0.5, de-DE, fr;q=0.8") // ["de-DE", "fr", "en"]
 */
export const parseAcceptLanguage = (header: string | null | undefined): string[] => {
  if (!header) return [];

  const isTruncated = header.length > MAX_HEADER_LENGTH;
  const entries = header.slice(0, MAX_HEADER_LENGTH).split(",");
  // A cut header ends mid-entry, and a partial tag ("de-D") would read as a real one.
  if (isTruncated) entries.pop();

  const weightedTags = entries
    .slice(0, MAX_PARSED_ENTRIES)
    .map((entry, position) => parseEntry(entry, position))
    .filter((weightedTag): weightedTag is TWeightedTag => weightedTag !== null)
    .sort((a, b) => b.quality - a.quality || a.position - b.position);

  const seen = new Set<string>();
  const tags: string[] = [];
  for (const { tag } of weightedTags) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length === MAX_BROWSER_LANGUAGE_CANDIDATES) break;
  }
  return tags;
};

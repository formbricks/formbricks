// Descending relevance; cmdk hides any item scored 0 and orders the rest by score.
const EXACT_MATCH = 1;
const PREFIX_MATCH = 0.9;
const WORD_PREFIX_MATCH = 0.8;
const CONTAINS_MATCH = 0.6;
const ALL_TERMS_MATCH = 0.4;
const NO_MATCH = 0;

const WORD_SEPARATOR = /[^\p{L}\p{N}]+/u;

/** Case- and accent-insensitive, so `zurich` finds `Europe/Zürich`. */
const normalize = (input: string): string =>
  input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/**
 * How well an option's label matches what the user typed, for `InputCombobox`'s `Command` filter.
 *
 * cmdk's built-in `commandScore` is a subsequence matcher: every character of the query only has to
 * appear somewhere in the haystack, in order. That scores `Bhagya Amarasinghe` at 0.0029 for the
 * query `harsh` — small, but above zero, so the option stays in the list. Worse, cmdk's haystack is
 * `value + " " + keywords.join(" ")`, and our `value` is the option's id: a member's cuid or a
 * duplicate of the label, neither of which the user can see. Both turn the picker's search into a
 * list of options that look unrelated to the query (ENG-2625).
 *
 * So this matches on the visible label alone, and only on whole runs of the query — a plain text
 * search, which is what a picker's search box reads as. Multi-word queries are the one relaxation:
 * each term may match separately, so `los angeles` still finds `America/Los_Angeles`.
 */
export const scoreComboboxOption = (label: string, search: string): number => {
  const query = normalize(search);
  // cmdk only calls the filter once something is typed; an empty query keeps every option anyway.
  if (!query) return EXACT_MATCH;

  const haystack = normalize(label);
  if (!haystack) return NO_MATCH;

  if (haystack === query) return EXACT_MATCH;
  if (haystack.startsWith(query)) return PREFIX_MATCH;
  if (haystack.split(WORD_SEPARATOR).some((word) => word.startsWith(query))) return WORD_PREFIX_MATCH;
  if (haystack.includes(query)) return CONTAINS_MATCH;

  const terms = query.split(/\s+/);
  if (terms.length > 1 && terms.every((term) => haystack.includes(term))) return ALL_TERMS_MATCH;

  return NO_MATCH;
};

/**
 * cmdk `CommandFilter` for `InputCombobox`: score the label carried in `keywords`, not the `value`.
 *
 * The `value` fallback only covers a `CommandItem` rendered without keywords; every option in
 * `InputCombobox` passes its label.
 */
export const filterComboboxOption = (value: string, search: string, keywords?: string[]): number =>
  scoreComboboxOption(keywords?.length ? keywords.join(" ") : value, search);

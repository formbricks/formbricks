/**
 * The value logic of the tags field (ENG-7248): how typed and pasted text becomes chips. Kept out of the
 * component so it is unit-tested; the component only wires keys and clicks to these.
 *
 * Values are compared ignoring case and surrounding spaces — the same rule Member attribute matching uses —
 * so "sweden" next to "Sweden" is one value and the first spelling wins.
 */

/** Characters that end a value while typing or pasting. Enter ends one too (handled as a key). */
export const CHIP_SEPARATOR_KEYS: ReadonlySet<string> = new Set([",", ";"]);

const SEPARATOR_PATTERN = /[,;\n\r\t]+/;

const chipKey = (value: string) => value.trim().toLowerCase();

/** "Sweden; Norway,  Denmark" → ["Sweden", "Norway", "Denmark"]: split on separators, trimmed, no blanks. */
export const splitChipInput = (text: string): string[] =>
  text
    .split(SEPARATOR_PATTERN)
    .map((part) => part.trim())
    .filter((part) => part !== "");

/** Whether `text` holds a separator, so a paste should become several chips rather than plain text. */
export const hasChipSeparator = (text: string): boolean => SEPARATOR_PATTERN.test(text);

/** Whether `value` is already among `values`, ignoring case and surrounding spaces. */
export const hasChip = (values: readonly string[], value: string): boolean => {
  const key = chipKey(value);
  return values.some((existing) => chipKey(existing) === key);
};

export type TAddChipsOptions = {
  /** Most chips the field holds; values past it are dropped. */
  maxValues?: number;
  /** Most characters in one value; longer ones are cut to it. */
  maxLength?: number;
};

/**
 * `current` with each of `incoming` appended in order, trimmed, skipping blanks and values already
 * present (ignoring case), and stopping at `maxValues`. Returns `current` itself when nothing changes, so
 * a caller can skip an update.
 */
export const addChips = (
  current: readonly string[],
  incoming: readonly string[],
  { maxValues = Number.POSITIVE_INFINITY, maxLength }: TAddChipsOptions = {}
): string[] => {
  const next = [...current];
  for (const raw of incoming) {
    if (next.length >= maxValues) break;
    const trimmed = raw.trim();
    const value = maxLength === undefined ? trimmed : trimmed.slice(0, maxLength).trim();
    if (value === "" || hasChip(next, value)) continue;
    next.push(value);
  }
  return next.length === current.length ? (current as string[]) : next;
};

/** `values` without the one at `index`. */
export const removeChipAt = (values: readonly string[], index: number): string[] =>
  values.filter((_, position) => position !== index);

/**
 * Suggestions to offer for `query`: those not already chosen, containing the query (ignoring case), in
 * their given order, at most `limit`.
 */
export const filterChipSuggestions = (
  suggestions: readonly string[],
  chosen: readonly string[],
  query: string,
  limit = 50
): string[] => {
  const needle = query.trim().toLowerCase();
  const seen = new Set<string>();
  const result: string[] = [];
  for (const suggestion of suggestions) {
    const key = chipKey(suggestion);
    if (key === "" || seen.has(key) || hasChip(chosen, suggestion)) continue;
    if (needle && !key.includes(needle)) continue;
    seen.add(key);
    result.push(suggestion);
    if (result.length >= limit) break;
  }
  return result;
};

/**
 * Whether the popover should offer `+ Add "<text>"` for what is typed: something is typed, it is not
 * chosen already, and no suggestion is that exact value (picking the suggestion keeps its spelling).
 */
export const canOfferNewChip = (
  query: string,
  chosen: readonly string[],
  visibleSuggestions: readonly string[]
): boolean => {
  const value = query.trim();
  if (value === "" || hasChip(chosen, value)) return false;
  return !hasChip(visibleSuggestions, value);
};

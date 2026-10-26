/**
 * The name a duplicate gets: "Name (copy)", then "Name (copy 2)", "Name (copy 3)" — the first one not
 * already taken. Duplicating a copy names it after the original, never "Name (copy) (copy)".
 *
 * Pure, so the rule is the same for charts and dashboards and is tested without a database; the caller
 * supplies the names already in use that start with `copyNamePrefix(name, maxLength)`. A name too long for
 * its suffix is shortened so the copy stays within `maxLength`, the longest name the API accepts back.
 */
const COPY_SUFFIX = / \(copy(?: \d+)?\)$/;

/** Room kept for the longest suffix a lookup must still match: " (copy 99999999)". */
const LONGEST_SUFFIX_LENGTH = 16;

export const stripCopySuffix = (name: string): string => name.replace(COPY_SUFFIX, "");

/** `text` cut to at most `length` UTF-16 units, never through the middle of a surrogate pair. */
const cutTo = (text: string, length: number): string => {
  if (text.length <= length) return text;
  const cut = text.slice(0, length);
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
};

const withSuffix = (base: string, suffix: string, maxLength: number): string =>
  `${cutTo(base, maxLength - suffix.length)}${suffix}`;

/**
 * What every candidate copy name of `name` starts with, to narrow the lookup of taken names. For a name
 * long enough to be shortened, a shorter prefix that every shortened candidate still starts with.
 */
export const copyNamePrefix = (name: string, maxLength: number): string => {
  const base = stripCopySuffix(name);
  return base.length + LONGEST_SUFFIX_LENGTH <= maxLength
    ? `${base} (copy`
    : cutTo(base, maxLength - LONGEST_SUFFIX_LENGTH);
};

export const nextCopyName = (name: string, takenNames: Iterable<string>, maxLength: number): string => {
  const base = stripCopySuffix(name);
  const taken = new Set(takenNames);

  const first = withSuffix(base, " (copy)", maxLength);
  if (!taken.has(first)) return first;

  let n = 2;
  while (taken.has(withSuffix(base, ` (copy ${n})`, maxLength))) n++;
  return withSuffix(base, ` (copy ${n})`, maxLength);
};

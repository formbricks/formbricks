/**
 * The name a duplicate gets: "Name (copy)", then "Name (copy 2)", "Name (copy 3)" — the first one not
 * already taken. Duplicating a copy names it after the original, never "Name (copy) (copy)".
 *
 * Pure, so the rule is the same for charts and dashboards and is tested without a database; the caller
 * supplies the names already in use that start with `copyNamePrefix(name)`.
 */
const COPY_SUFFIX = / \(copy(?: \d+)?\)$/;

export const stripCopySuffix = (name: string): string => name.replace(COPY_SUFFIX, "");

/** What every candidate copy name of `name` starts with, to narrow the lookup of taken names. */
export const copyNamePrefix = (name: string): string => `${stripCopySuffix(name)} (copy`;

export const nextCopyName = (name: string, takenNames: Iterable<string>): string => {
  const base = stripCopySuffix(name);
  const taken = new Set(takenNames);

  const first = `${base} (copy)`;
  if (!taken.has(first)) return first;

  let n = 2;
  while (taken.has(`${base} (copy ${n})`)) n++;
  return `${base} (copy ${n})`;
};

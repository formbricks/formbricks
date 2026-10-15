/**
 * Escape `value` for a `LIKE`/`ILIKE` pattern, so its `%`, `_` and `\` match themselves. Prisma's
 * `contains`, `startsWith` and `endsWith` filters wrap the value in wildcards but do not escape it: a
 * search for `%` matches every row. PostgreSQL's default escape character is the backslash.
 */
export const escapeLikePattern = (value: string): string => value.replaceAll(/[\\%_]/g, String.raw`\$&`);

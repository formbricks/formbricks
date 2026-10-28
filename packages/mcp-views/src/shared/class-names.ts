/**
 * Joins class names, skipping falsy values. Used instead of template literals in `className`: the repo's
 * Prettier class sorter rewrites those and drops the space before an interpolation.
 */
export const classNames = (...names: (string | false | null | undefined)[]): string =>
  names.filter(Boolean).join(" ");

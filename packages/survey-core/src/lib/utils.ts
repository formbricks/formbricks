/**
 * Utility function to combine class names
 * Filters out falsy values and joins them with spaces
 */
export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(" ");
};

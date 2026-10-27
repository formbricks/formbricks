/**
 * The paste box takes one entry per line. Lines are trimmed and blank ones dropped, so a trailing
 * newline or a gap in a pasted list never becomes an empty entry, which would match every URL.
 */
export const parseListInput = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");

const MAX_LISTED_ENTRIES = 3;

/** A short, readable version of a condition's value for one line of text: lists are cut after three. */
export const summarizeConditionValue = (condition: {
  rightOperand?: { value: string | number | string[] };
}): string => {
  const value = condition.rightOperand?.value;
  if (value === undefined) return "";
  if (!Array.isArray(value)) return String(value);

  const shown = value.slice(0, MAX_LISTED_ENTRIES).join(", ");
  const hidden = value.length - MAX_LISTED_ENTRIES;
  return hidden > 0 ? `${shown} (+${hidden.toString()})` : shown;
};

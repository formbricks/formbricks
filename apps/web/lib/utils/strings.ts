// write a function that takes a string and truncates it to the specified length
export const truncate = (str: string, length: number) => {
  if (!str) return "";
  if (str.length > length) {
    return str.substring(0, length) + "...";
  }
  return str;
};

// write a function that takes a string and removes all characters that could cause issues with the url and truncates it to the specified length
export const sanitizeString = (str: string, delimiter: string = "_", length: number = 255) => {
  return str.replace(/[^0-9a-zA-Z\-._]+/g, delimiter).substring(0, length);
};

export const isCapitalized = (str: string) => str.charAt(0) === str.charAt(0).toUpperCase();

export const startsWithVowel = (str: string): boolean => {
  return /^[aeiouAEIOU]/.test(str);
};

export const truncateText = (text: string, limit: number): string => {
  return text.length > limit ? `${text.substring(0, limit)}...` : text;
};

/**
 * C0 and C1 control characters, the line and paragraph separators (U+2028, U+2029, which `JSON.stringify` leaves
 * raw), and the bidirectional marks and overrides (U+200E, U+200F, U+061C, U+202A-U+202E, U+2066-U+2069): what can
 * fake a line break or reorder text in a log viewer.
 */
const LOG_UNSAFE_CHARACTERS =
  // eslint-disable-next-line no-control-regex -- matching control characters is the point
  /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g;

/**
 * Untrusted text made safe to log: control and bidi-override characters replaced by `?`, and the result capped
 * at `limit` characters. `undefined` for anything that is not a string, so a field is simply left out.
 */
export const toLogText = (value: unknown, limit: number): string | undefined =>
  typeof value === "string" ? truncateText(value.replace(LOG_UNSAFE_CHARACTERS, "?"), limit) : undefined;

export const isStringMatch = (query: string, value: string): boolean => {
  // lowercase both query and value
  // replace all spaces with empty string
  // replace all underscores with empty string
  // replace all dashes with empty string
  const queryModified = query.toLowerCase().replace(/ /g, "").replace(/_/g, "").replace(/-/g, "");
  const valueModified = value.toLowerCase().replace(/ /g, "").replace(/_/g, "").replace(/-/g, "");

  return valueModified.includes(queryModified);
};

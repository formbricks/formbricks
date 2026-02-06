/**
 * Returns the display name for a language code using Intl.DisplayNames (built-in, 0 KB).
 * Falls back to the code if the API is unavailable or the tag is unknown.
 */
export function getLanguageDisplayName(code: string): string {
  if (typeof Intl === "undefined" || !Intl.DisplayNames) return code;
  try {
    const displayNames = new Intl.DisplayNames(["en-US"], { type: "language" });
    const name = displayNames.of(code);
    return name && name !== code ? name : code;
  } catch {
    return code;
  }
}

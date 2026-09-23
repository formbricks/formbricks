/**
 * True for a bare Escape press — the one every survey popup and modal closes on.
 *
 * Alt/Ctrl/Meta+Escape are left alone because the OS and browser bind those combinations
 * themselves (task switching, stopping a page load), so treating them as "close" would swallow
 * shortcuts the respondent meant for something else. Shift is allowed through: it changes nothing
 * about what Escape means, and a user holding it mid-selection should still be able to dismiss.
 */
export const isPlainEscape = (
  event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey">
): boolean => event.key === "Escape" && !event.altKey && !event.ctrlKey && !event.metaKey;

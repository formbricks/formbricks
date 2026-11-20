/**
 * Pages under the app layout that emails link to and that work at phone width. People open email
 * links on their phones, so the tiny-screen overlay must not cover these (ENG-7080). Each entry is a
 * path prefix ending in "/": it matches the pages below it, not the bare prefix.
 */
const MOBILE_FRIENDLY_PATH_PREFIXES = [
  // "Your attachments are ready" email: the export's state, with Download and Go to responses.
  "/attachment-exports/",
];

export const isMobileFriendlyPath = (pathname: string | null): boolean => {
  if (!pathname) return false;
  return MOBILE_FRIENDLY_PATH_PREFIXES.some(
    (prefix) => pathname.startsWith(prefix) && pathname.length > prefix.length
  );
};

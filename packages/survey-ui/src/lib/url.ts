/**
 * True when a stored survey link target is safe to hand to `window.open()` or `location.replace()`.
 *
 * `@formbricks/types` constrains the scheme of these fields, but the renderer must not depend on that
 * alone: it is handed survey JSON from the API, and rows written before that validation landed — or
 * through a write path that skips validation, as draft survey updates do — can still carry a
 * `javascript:`, `data:` or `vbscript:` URL, which executes on the survey's own origin when navigated
 * to.
 *
 * Parsing (rather than a prefix test) normalizes obfuscated schemes such as `java\tscript:`, which a
 * `startsWith` check would wave through. Kept local rather than imported from `@formbricks/types`
 * because this package deliberately carries no dependency on it — the same reason `isSafeMediaUrl`
 * lives here.
 */
export const isSafeLinkUrl = (url: string): boolean => {
  try {
    const { protocol } = new URL(url.trim());
    return protocol === "https:" || protocol === "http:" || protocol === "mailto:" || protocol === "tel:";
  } catch {
    return false;
  }
};

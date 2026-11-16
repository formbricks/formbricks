const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Encodes a string so it renders as literal text in HTML, in element content or a quoted attribute.
 *
 * Encoding, not sanitizing: `sanitize-html` and DOMPurify parse markup and *remove* what isn't allowed,
 * which is the wrong tool for text: a respondent who answers `<b>bold</b>`, or a reviewer who types it
 * into a sheet, should see that text, not have it silently dropped. Escaping is also what makes the value inert regardless of where
 * the surrounding template puts it.
 *
 * Single pass over the five characters rather than chained `replaceAll`s, so `&` cannot be
 * double-encoded if someone reorders the entries — with sequential replacements, moving the `&` rule
 * after the others turns `<` into `&amp;lt;`.
 */
export const escapeHtml = (value: string): string =>
  value.replaceAll(/[&<>"']/g, (char) => HTML_ENTITIES[char]);

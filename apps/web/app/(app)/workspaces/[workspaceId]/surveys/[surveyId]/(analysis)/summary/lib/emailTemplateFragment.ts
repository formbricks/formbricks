import { findClosingTag, findOpeningTag } from "@/lib/utils/html-opening-tag";

const EMAIL_REACT_SERVER_MARKER_PATTERN = /<!--\/?\$-->/g;

/**
 * The body content, or null when the document has no `<body>…</body>`.
 *
 * Two scans rather than `<body\b[^>]*>([\s\S]*?)<\/body>`. That pattern is quadratic twice over: the
 * attribute run rescans from every `<body` when no `>` follows, and the lazy content group expands
 * to the end of the document once per `<body>` when no `</body>` follows. Capping fixes neither —
 * the content group is the whole email and cannot be capped, and capping the attribute run makes an
 * over-long tag match a LATER `<body>` instead, extracting the wrong span.
 *
 * Same result as the regex. It matched the leftmost `<body…>` that has a `</body>` after it, and if
 * none follows the first opening tag then none follows a later one either, so taking the first
 * opening tag and the first close after it picks exactly the same span.
 */
const extractBodyContent = (html: string): string | null => {
  const openTag = findOpeningTag(html, "body");
  if (!openTag) return null;

  const contentStart = openTag.index + openTag.length;
  const contentEnd = findClosingTag(html, "body", contentStart);

  return contentEnd === -1 ? null : html.slice(contentStart, contentEnd);
};

export const extractEmailBodyFragment = (html: string): string => {
  const doctype = findOpeningTag(html, "!DOCTYPE", { requireWordBoundary: false });
  const htmlWithoutDoctype = (
    doctype ? html.slice(0, doctype.index) + html.slice(doctype.index + doctype.length) : html
  ).trim();

  const fragment = extractBodyContent(htmlWithoutDoctype)?.trim() ?? htmlWithoutDoctype;

  return fragment.replaceAll(EMAIL_REACT_SERVER_MARKER_PATTERN, "").trim();
};

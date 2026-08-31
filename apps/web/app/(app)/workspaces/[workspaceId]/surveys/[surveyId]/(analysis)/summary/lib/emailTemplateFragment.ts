import { findOpeningTag } from "@/lib/utils/html-opening-tag";

const EMAIL_BODY_CLOSE_TAG = "</body>";
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
  const contentEnd = findCloseTagIndex(html, contentStart);

  return contentEnd === -1 ? null : html.slice(contentStart, contentEnd);
};

/**
 * `</body>` is matched case-insensitively, like the `i` flag did. Deliberately not
 * `html.toLowerCase().indexOf(...)`: lowercasing is not length-preserving (U+0130 becomes two code
 * units), so a document containing one would return an index into a differently-sized string.
 */
const findCloseTagIndex = (html: string, from: number): number => {
  for (let index = from; index <= html.length - EMAIL_BODY_CLOSE_TAG.length; index++) {
    if (html.startsWith(EMAIL_BODY_CLOSE_TAG, index)) return index;
    // Only the ASCII letters differ in case here, so a case-folded comparison of the slice is exact.
    if (html.slice(index, index + EMAIL_BODY_CLOSE_TAG.length).toLowerCase() === EMAIL_BODY_CLOSE_TAG) {
      return index;
    }
  }
  return -1;
};

export const extractEmailBodyFragment = (html: string): string => {
  const doctype = findOpeningTag(html, "!DOCTYPE", { requireWordBoundary: false });
  const htmlWithoutDoctype = (
    doctype ? html.slice(0, doctype.index) + html.slice(doctype.index + doctype.length) : html
  ).trim();

  const fragment = extractBodyContent(htmlWithoutDoctype)?.trim() ?? htmlWithoutDoctype;

  return fragment.replaceAll(EMAIL_REACT_SERVER_MARKER_PATTERN, "").trim();
};

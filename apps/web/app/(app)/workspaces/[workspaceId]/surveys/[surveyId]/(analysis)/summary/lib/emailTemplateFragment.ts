// The attribute run is length-capped so a `<body`/`<!DOCTYPE` repeated with no closing `>` cannot
// make the engine rescan to the end from every occurrence (O(N^2) — measured 1.3s on 200k chars).
// The cap is ~30x the longest tag these emails carry, so every real document matches exactly as
// before; past it the tag is left alone rather than stripped, which degrades to "keep the markup",
// never to corrupted output.
const EMAIL_TAG_ATTRIBUTES_MAX = 4096;
const EMAIL_DOCTYPE_PATTERN = new RegExp(`<!DOCTYPE[^>]{0,${EMAIL_TAG_ATTRIBUTES_MAX}}>`, "i");
const EMAIL_BODY_OPEN_TAG_PATTERN = new RegExp(`<body\\b[^>]{0,${EMAIL_TAG_ATTRIBUTES_MAX}}>`, "i");
const EMAIL_BODY_CLOSE_TAG = "</body>";
const EMAIL_REACT_SERVER_MARKER_PATTERN = /<!--\/?\$-->/g;

/**
 * The body content, or null when the document has no `<body>…</body>`.
 *
 * Two index scans rather than `<body\b[^>]*>([\s\S]*?)<\/body>`: capping the attribute run alone did
 * not help that pattern (measured 766ms before and after on 200k chars), because the cost is in the
 * lazy `([\s\S]*?)` — it expands to the end of the document looking for a `</body>` that never
 * arrives, once per `<body>` occurrence. Capping the CONTENT instead is not an option: that group is
 * the whole email, legitimately large.
 *
 * Same result as the regex. It matched the leftmost `<body…>` that has a `</body>` after it, and if
 * none follows the first opening tag then none follows a later one either — so taking the first
 * opening tag and the first close after it picks exactly the same span.
 */
const extractBodyContent = (html: string): string | null => {
  const openTag = EMAIL_BODY_OPEN_TAG_PATTERN.exec(html);
  if (!openTag) return null;

  const contentStart = openTag.index + openTag[0].length;
  // `indexOf` on a lowercased copy keeps the regex's case-insensitivity at one linear pass, rather
  // than the per-position retry a case-insensitive search would cost.
  const contentEnd = html.toLowerCase().indexOf(EMAIL_BODY_CLOSE_TAG, contentStart);

  return contentEnd === -1 ? null : html.slice(contentStart, contentEnd);
};

export const extractEmailBodyFragment = (html: string): string => {
  const htmlWithoutDoctype = html.replace(EMAIL_DOCTYPE_PATTERN, "").trim();
  const fragment = extractBodyContent(htmlWithoutDoctype)?.trim() ?? htmlWithoutDoctype;

  return fragment.replaceAll(EMAIL_REACT_SERVER_MARKER_PATTERN, "").trim();
};

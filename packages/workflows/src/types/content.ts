// An opening or closing tag: `<` (or `</`) followed by a tag NAME, so the pattern can't swallow
// visible text that merely contains an angle bracket. The gate matters because the editor's
// serializer un-escapes `&lt;`/`&gt;` back into literal brackets before storing — without it a body
// of "<3" strips down to nothing and reads as blank.
//
// The body of the tag excludes `<` as well as `>`, which matters for two reasons:
//   1. It keeps matching linear. With `[^>]*`, an unterminated `<A` repeated n times makes the
//      engine rescan to end-of-string from every `<`, i.e. O(n²) — 200KB of `<A<A…` took ~28s in a
//      single pass, blocking the whole event loop, and the executable schema runs this on a stored
//      body an API client controls (CodeQL js/polynomial-redos). Excluding `<` lets a failed match
//      stop at the next `<` instead, which is linear.
//   2. A tag genuinely cannot contain `<` — the HTML spec makes it a parse error — so this also
//      stops a stray `<b` in visible text from consuming the real `</p>` that follows it.
const HTML_TAG_PATTERN = /<\/?[a-zA-Z][^<>]*>/g;

// Entities the editor emits for whitespace. They carry no visible content but survive tag removal.
const HTML_WHITESPACE_ENTITY_PATTERN = /&nbsp;|&#160;|&#xa0;/gi;

/**
 * Whether a rich-text (HTML) workflow field holds nothing a recipient would see.
 *
 * The `send_email` body is authored in a Lexical editor whose serializer always emits the
 * enclosing block, so a body the user emptied out comes back as `<p class="…"><br></p>` — 11+
 * characters — rather than `""`. A plain `.trim()` check therefore reads a blank body as filled,
 * which let an empty-bodied workflow clear its "needs contents" flag and be enabled.
 *
 * Recall tokens survive this check: `RecallNode.exportDOM` writes the
 * `#recall:<id>/fallback:<value>#` token as the element's text content, so a body consisting only
 * of a recall token is correctly treated as filled.
 *
 * Known limit: because the stored value is not guaranteed well-formed HTML (see the un-escaping
 * above), tag detection is a regex rather than a parse, so a `<` inside an attribute value
 * (`<p title="a<b"></p>`) ends the tag early and leaves the rest of the markup looking like visible
 * text — an empty body then reads as filled. The editor cannot produce that: it emits only fixed
 * `class`/`dir`/`style` attributes plus a link `href`, and a link carries text of its own. An API
 * client can, since `body` is a free string, and the cost is one author sending themselves an empty
 * email. Resolving it properly needs the editor to persist an unambiguous representation rather than
 * lossy HTML.
 */
export const isBlankWorkflowRichText = (value: string): boolean =>
  value.replaceAll(HTML_TAG_PATTERN, "").replaceAll(HTML_WHITESPACE_ENTITY_PATTERN, " ").trim().length === 0;

/** The `send_email` config fields an executable workflow must have filled, in form order. */
export const SEND_EMAIL_REQUIRED_CONTENT_FIELDS = ["to", "subject", "body"] as const;
export type TWorkflowSendEmailContentField = (typeof SEND_EMAIL_REQUIRED_CONTENT_FIELDS)[number];

/**
 * Which required `send_email` content fields are still blank, in form order — the single rule the
 * executable schema, the canvas issue flag, and the inspector's per-field errors all read, so the
 * three can never disagree about what is missing.
 *
 * Structurally typed rather than taking `TWorkflowSendEmailActionConfig` so the emptiness rules
 * stay free of the schema module.
 */
export const getBlankSendEmailContentFields = (
  config: Readonly<Record<TWorkflowSendEmailContentField, string>>
): TWorkflowSendEmailContentField[] =>
  SEND_EMAIL_REQUIRED_CONTENT_FIELDS.filter((field) =>
    // Only the body is rich text; `to` and `subject` are plain strings.
    field === "body" ? isBlankWorkflowRichText(config[field]) : config[field].trim().length === 0
  );

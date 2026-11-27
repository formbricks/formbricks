import { addHook, removeHook, sanitize } from "isomorphic-dompurify";

// How survey text is cleaned for rendering. Its own module, exported as `@formbricks/survey-ui/sanitize`,
// so the server can check stored text against exactly what respondents will see (ENG-3891) without
// importing the component bundle.

// One opening tag. A quoted value is consumed whole, so a `>` inside it does not end the tag, and `<` is
// excluded outside quotes so a stray one ends the attempt instead of scanning to the end of the string.
// Every alternative starts with a different character, so there is no backtracking to speak of.
const OPENING_TAG = /<[a-zA-Z](?:"[^"]*"|'[^']*'|[^<>"'])*>/g;
// Inside a tag, one attribute: a name and an optional `= value`. The value is quoted or bare, and a quoted
// one is consumed whole, so text inside another attribute's value that looks like `style = 'x'`
// (`title="Choose style = 'casual'"`) is never mistaken for an attribute. Built from named parts so each
// stays readable.
// The separator in front of the name is ONE optional whitespace character, deliberately not `\s+`: a run of
// n spaces would be rescanned from every position (quadratic), and HTML does not need a separator after a
// closing quote (`title="x"style="y"`), where browsers still read `style` as an attribute. No lookbehind:
// an engine without it would throw while this module loads.
const ATTRIBUTE_NAME = String.raw`[^\s"'<>/=]+`;
const ATTRIBUTE_VALUE = String.raw`"[^"]*"|'[^']*'|[^\s"'>]*`;
const ATTRIBUTE = new RegExp(String.raw`\s?(${ATTRIBUTE_NAME})(?:\s*=\s*(?:${ATTRIBUTE_VALUE}))?`, "g");
// `<p`, the tag name, which is not an attribute (a `<style>` element is not a style attribute).
const TAG_NAME = /^<[^\s/>]+/;

/**
 * Removes `style` attributes from the opening tags of a raw HTML string, without parsing it.
 * Must run BEFORE anything parses the markup: under a strict CSP `style-src` the browser reports every
 * element it parses with a style attribute, even one discarded afterwards, so stripping the attribute
 * from the parsed tree is too late.
 * Any whitespace may separate the attribute from the tag (a newline or tab, not just a space), or nothing
 * at all after a closing quote or a `/`, and it may surround the `=`; the value may be quoted or not. Text
 * outside tags, and other attributes' values, are left alone.
 * @param html - The raw HTML string
 * @returns The string without its style attributes
 */
export const removeStyleAttributes = (html: string): string =>
  html.replaceAll(OPENING_TAG, (tag) => {
    const tagName = TAG_NAME.exec(tag)?.[0] ?? "";
    const attributes = tag
      .slice(tagName.length)
      .replaceAll(ATTRIBUTE, (attribute, name: string) => (name.toLowerCase() === "style" ? "" : attribute));
    return tagName + attributes;
  });

/**
 * Strip inline style attributes from HTML string to avoid CSP violations
 * Uses DOMPurify for secure, proper HTML parsing after the raw string is pre-stripped
 * @param html - The HTML string to process
 * @returns HTML string with all style attributes removed
 */
export const stripInlineStyles = (html: string): string => {
  if (!html) return html;

  // DOMPurify parses with the browser's HTML parser, which triggers CSP `style-src` violations at
  // parse time, before FORBID_ATTR can strip anything, so the attributes go from the raw string first.
  const preStripped = removeStyleAttributes(html);

  return sanitize(preStripped, {
    FORBID_ATTR: ["style"],
    ADD_ATTR: ["target"],
    KEEP_CONTENT: true,
  });
};

/**
 * Force every link in survey content to open in a new tab.
 * Links pasted as plain text are auto-linked without a target, so without this a
 * respondent following one navigates away from the survey they are filling in.
 * Kept on the render path so surveys authored before the editor fix behave too.
 * @param node - The node DOMPurify is currently sanitizing
 */
const openLinksInNewTab = (node: Element): void => {
  if (node.tagName !== "A" || !node.hasAttribute("href")) return;
  // Only the survey's own frame or a new tab: `_top`, `_parent` or a named window would let survey text
  // navigate the page a survey is embedded in.
  if (node.getAttribute("target") !== "_self") {
    node.setAttribute("target", "_blank");
  }
  if (node.getAttribute("target") === "_blank") {
    node.setAttribute("rel", "noopener noreferrer");
  }
};

/**
 * The link targets survey text may hold: `http(s):`, `mailto:` and `tel:`, plus a URL with no scheme at
 * all. That last part is DOMPurify's own default rule for schemeless values, unchanged: the editor's
 * auto-linker stores `www.example.com` as written, and imported or older content holds `#anchor`, `/path`
 * and `page.html` links. A value counts as schemeless when it starts with a non-letter, or its leading run
 * of scheme characters (`a-z + . -`) is not followed by `:`. So `javascript:`, `data:`, `vbscript:` and every
 * other scheme are refused. DOMPurify removes whitespace and control characters (`ATTR_WHITESPACE`) before it
 * tests the value, and the HTML parser has already decoded entities, so `java\tscript:`, ` javascript:` and
 * `javascript&colon;` reach this test as `javascript:` and fail it. `/i` covers `JaVaScRiPt:`.
 */
const SURVEY_LINK_URI = /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

/**
 * What survey text may contain: the markup the rich-text editor writes (paragraphs, line breaks, lists,
 * headings, bold, italic, underline, strikethrough, highlight, quotes, code, links) and nothing else.
 * DOMPurify's default profile also keeps `<style>`, `<img>`, `<form>` and `<input>`, which let hostile
 * text (a recalled URL parameter, an imported survey) restyle the page or draw a fake prompt.
 * `style` is not allowed (CSP). `ALLOWED_URI_REGEXP` applies to every attribute DOMPurify does not treat
 * as URI-safe, so the non-URL attributes are declared URI-safe or they are dropped.
 */
const SURVEY_HTML_SANITIZE_CONFIG = {
  // Blocks and links, then inline formatting, then headings.
  ALLOWED_TAGS: [
    "p",
    "br",
    "span",
    "a",
    "ul",
    "ol",
    "li",
    "blockquote",
    "pre",
    "code",
    "b",
    "strong",
    "i",
    "em",
    "u",
    "s",
    "mark",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
  ],
  ALLOWED_ATTR: ["class", "dir", "href", "target", "rel", "start", "value"],
  ALLOWED_URI_REGEXP: SURVEY_LINK_URI,
  ADD_URI_SAFE_ATTR: ["target", "rel", "dir", "start"],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
};

/**
 * Sanitize survey content HTML for rendering: strips inline styles (CSP) and makes
 * links open in a new tab.
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string, safe to pass to dangerouslySetInnerHTML
 */
export const sanitizeSurveyHtml = (html: string): string => {
  if (!html) return html;

  addHook("afterSanitizeAttributes", openLinksInNewTab);
  try {
    return sanitize(stripInlineStyles(html), SURVEY_HTML_SANITIZE_CONFIG);
  } finally {
    removeHook("afterSanitizeAttributes");
  }
};

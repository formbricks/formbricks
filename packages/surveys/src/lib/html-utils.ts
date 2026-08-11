import DOMPurify from "isomorphic-dompurify";

/**
 * Strip inline style attributes from HTML string to avoid CSP violations
 * Uses DOMPurify for secure, proper HTML parsing instead of regex
 * @param html - The HTML string to process
 * @returns HTML string with all style attributes removed
 * @note This is a security measure to prevent CSP violations during HTML parsing
 */
export const stripInlineStyles = (html: string): string => {
  if (!html) return html;

  // Pre-strip style attributes from the raw string BEFORE DOMPurify parses it.
  // DOMPurify internally uses innerHTML to parse HTML, which triggers CSP
  // `style-src` violations at parse time — before FORBID_ATTR can strip them.
  // The regex is O(n) safe: [^"]* and [^']* are negated classes bounded by
  // fixed quote delimiters, so no backtracking can occur.
  const preStripped = html.replaceAll(/ style="[^"]*"| style='[^']*'/gi, "");

  return DOMPurify.sanitize(preStripped, {
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
  if (!node.getAttribute("target")) {
    node.setAttribute("target", "_blank");
  }
  if (node.getAttribute("target") === "_blank") {
    node.setAttribute("rel", "noopener noreferrer");
  }
};

/**
 * Sanitize survey content HTML for rendering: strips inline styles (CSP) and makes
 * links open in a new tab.
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string, safe to pass to dangerouslySetInnerHTML
 */
export const sanitizeSurveyHtml = (html: string): string => {
  if (!html) return html;

  DOMPurify.addHook("afterSanitizeAttributes", openLinksInNewTab);
  try {
    return DOMPurify.sanitize(stripInlineStyles(html), {
      ADD_ATTR: ["target"],
      FORBID_ATTR: ["style"], // Additional safeguard to remove any remaining inline styles
    });
  } finally {
    DOMPurify.removeHook("afterSanitizeAttributes");
  }
};

/**
 * Lightweight HTML detection for browser environments
 * Uses native DOMParser (built-in, 0 KB bundle size)
 * @param str - The input string to test
 * @returns true if the string contains valid HTML elements, false otherwise
 * @note Returns false in non-browser environments (SSR, Node.js) where window is undefined
 * @note Strips inline styles before parsing to avoid CSP violations
 */
export const isValidHTML = (str: string): boolean => {
  // This should ideally never happen because the surveys package should be used in an environment where DOM is available
  if (typeof globalThis?.window === "undefined") return false;

  if (!str) return false;

  try {
    // Strip inline style attributes to avoid CSP violations during parsing
    const strippedStr = stripInlineStyles(str);

    const doc = new DOMParser().parseFromString(strippedStr, "text/html");
    const errorNode = doc.querySelector("parsererror");
    if (errorNode) return false;
    return Array.from(doc.body.childNodes).some((node) => node.nodeType === 1);
  } catch {
    return false;
  }
};

/**
 * Extracts readable plain text from a possibly-HTML string, e.g. for an aria-label
 * where raw markup would otherwise leak into the accessible name.
 * @param value - The string (plain or HTML) to flatten
 * @returns The text content; falls back to the original value outside the browser or on error
 */
export const htmlToPlainText = (value: string): string => {
  // DOMParser is unavailable outside the browser (e.g. SSR); return the raw value there.
  if (!value || !("DOMParser" in globalThis)) return value;

  try {
    return new DOMParser().parseFromString(value, "text/html").body.textContent?.trim() ?? value;
  } catch {
    return value;
  }
};

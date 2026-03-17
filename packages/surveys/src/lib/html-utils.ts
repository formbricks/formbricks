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
  // `style-src` violations if the input contains style attributes — even though
  // FORBID_ATTR would remove them afterwards. By stripping them first, the
  // browser's HTML parser never encounters them.
  const preStripped = html.replace(/\s+style\s*=\s*(?:"[^"]*"|'[^']*')/gi, "");

  return DOMPurify.sanitize(preStripped, {
    FORBID_ATTR: ["style"],
    ADD_ATTR: ["target"],
    KEEP_CONTENT: true,
  });
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

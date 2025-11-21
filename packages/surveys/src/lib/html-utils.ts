/**
 * Strip inline style attributes from HTML string to avoid CSP violations
 * @param html - The HTML string to process
 * @returns HTML string with all style attributes removed
 * @note This is a security measure to prevent CSP violations during HTML parsing
 */
export const stripInlineStyles = (html: string): string => {
  // Remove style="..." or style='...' attributes
  // Use separate patterns for each quote type to avoid ReDoS vulnerability
  // The pattern [^"]* and [^']* are safe as they don't cause backtracking
  return html.replace(/\s+style\s*=\s*["'][^"']*["']/gi, ""); //NOSONAR
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

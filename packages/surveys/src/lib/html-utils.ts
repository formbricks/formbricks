import { stripInlineStyles } from "@formbricks/survey-ui";

// Sanitization that has to stay identical between the SDK bundle and the React
// components lives in survey-ui; re-exported here so callers keep one import.
// Never parse survey text with a DOM API directly: a strict `style-src` reports every element
// parsed with a style attribute, so run it through `stripInlineStyles` first.
export { sanitizeSurveyHtml, stripInlineStyles } from "@formbricks/survey-ui";

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

    // eslint-disable-next-line no-restricted-syntax -- strippedStr is stripInlineStyles output
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
 * @note Strips inline styles before parsing to avoid CSP violations
 */
export const htmlToPlainText = (value: string): string => {
  // DOMParser is unavailable outside the browser (e.g. SSR); return the raw value there.
  if (!value || !("DOMParser" in globalThis)) return value;

  try {
    return (
      // eslint-disable-next-line no-restricted-syntax -- the value passes through stripInlineStyles
      new DOMParser().parseFromString(stripInlineStyles(value), "text/html").body.textContent?.trim() ?? value
    );
  } catch {
    return value;
  }
};

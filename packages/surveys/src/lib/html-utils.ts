/**
 * Lightweight HTML detection for browser environments
 * Uses native DOMParser (built-in, 0 KB bundle size)
 * @param str - The input string to test
 * @returns true if the string contains valid HTML elements, false otherwise
 */
export const isValidHTML = (str: string): boolean => {
  if (!str) return false;

  try {
    const doc = new DOMParser().parseFromString(str, "text/html");
    const errorNode = doc.querySelector("parsererror");
    if (errorNode) return false;
    return Array.from(doc.body.childNodes).some((node) => node.nodeType === 1);
  } catch {
    return false;
  }
};

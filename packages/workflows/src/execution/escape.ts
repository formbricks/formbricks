const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes the HTML-significant characters in a string so respondent-controlled values cannot inject markup. */
export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates a single, already-resolved recipient address. Rejects empty, multi-address, and malformed values. */
export const isValidEmail = (value: string): boolean => EMAIL_PATTERN.test(value.trim());

// eslint-disable-next-line no-control-regex -- intentionally matching control chars to strip them
const CONTROL_CHARS_PATTERN = /[\x00-\x1f]/g;

/** Strips CR/LF and other control chars, defending against header injection via respondent-controlled values. */
export const stripControlChars = (value: string): string => value.replace(CONTROL_CHARS_PATTERN, "");

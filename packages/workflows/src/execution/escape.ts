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

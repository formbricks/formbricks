import { QSF_MAX_TEXT_CHARS } from "./limits";

/**
 * Whether the sanitizer has to parse a text: one with a `<` or an `&` goes through DOMPurify, one
 * without only has its whitespace collapsed. Shared by the sanitizer's fast path and the reader, which
 * counts these texts against `QSF_MAX_MARKUP_TEXTS` while the file is read.
 */
export const hasMarkup = (text: string): boolean => text.includes("<") || text.includes("&");

/** Whether a raw text will cost a DOMPurify parse: markup, and within the length the sanitizer takes. */
export const needsParsing = (text: string): boolean => text.length <= QSF_MAX_TEXT_CHARS && hasMarkup(text);

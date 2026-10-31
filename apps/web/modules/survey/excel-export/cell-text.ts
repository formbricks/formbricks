import type { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { recallToHeadline } from "@/lib/utils/recall";
import { EXCEL_EXPORT_MAX_CELL_CHARS } from "./limits";

// A line break after each block-level closing tag and `<br>`, so paragraphs and list items stay on their
// own lines once the markup is gone instead of running into each other.
const BLOCK_BREAK = /<\/(?:p|div|li|h[1-6]|blockquote|pre)>|<br\s*\/?>/gi;
const EXTRA_BLANK_LINES = /\n{3,}/g;

// Control characters other than tab, line feed and carriage return (XML 1.0 can't hold the C0 ones, and
// none is readable text), the non-characters U+FFFE/U+FFFF, and lone surrogates. SheetJS writes the C0
// ones as `&#x1;`, which makes Excel refuse to open the file as corrupt.
const XML_INVALID = /[^\P{Cc}\t\n\r]|[\uFFFE\uFFFF]|\p{Cs}/gu;

const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;

/** Rich text as the respondent reads it: the words only, one line per paragraph. */
const flattenRichText = (html: string): string =>
  getTextContent(html.replaceAll(BLOCK_BREAK, "$&\n"))
    // Split rather than a `[ \t]+\n` pattern, which backtracks quadratically on a long run of spaces.
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replaceAll(EXTRA_BLANK_LINES, "\n\n");

/**
 * `text` cut to fit one spreadsheet cell (32,767 characters), ending in `truncatedSuffix` when it was cut.
 * Never splits a surrogate pair, so an emoji at the cut is dropped whole.
 */
export const fitCell = (text: string, truncatedSuffix: string): string => {
  if (text.length <= EXCEL_EXPORT_MAX_CELL_CHARS) return text;
  let end = EXCEL_EXPORT_MAX_CELL_CHARS - truncatedSuffix.length;
  if (isHighSurrogate(text.charCodeAt(end - 1))) end -= 1;
  return `${text.slice(0, end)}${truncatedSuffix}`;
};

/** `text` with the characters an xlsx file cannot hold removed. */
export const toXmlSafeText = (text: string): string => text.replaceAll(XML_INVALID, "");

/**
 * One stored survey text as a reviewer should read it in `languageCode`'s column: rich text flattened to
 * its words, and each recall token shown as `@Label`, the way the editor shows it, with the label in the
 * same language. `languageCode` is `default` for the default language, as in the stored texts.
 */
export const toReadableText = ({
  text,
  isRichText,
  survey,
  languageCode,
}: {
  text: string;
  isRichText: boolean;
  survey: TSurvey;
  languageCode: string;
}): string => {
  const plain = isRichText ? flattenRichText(text) : text;
  if (!plain.includes("#recall:")) return plain;
  return recallToHeadline({ [languageCode]: plain, default: plain }, survey, false, languageCode)[
    languageCode
  ];
};

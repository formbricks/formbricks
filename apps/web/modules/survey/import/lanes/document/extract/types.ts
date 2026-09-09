import type { TImportIssue } from "../../../types";

/** Hard cap on the normalized text handed to the model side (edge case #39). */
export const EXTRACT_MAX_CHARS = 400_000;
/** Parsers run under this budget; a DOCX or PDF that takes longer is reported, not awaited. */
export const EXTRACT_TIMEOUT_MS = 10_000;
/** Zip guards for DOCX and XLSX (both are zip archives): entry count and total uncompressed size. */
export const ARCHIVE_MAX_ENTRIES = 500;
export const ARCHIVE_MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;

export const PAGE_BREAK = "\n\n---\n\n";

export type TExtractedDocumentStats = {
  chars: number;
  paragraphs: number;
  listItems: number;
  tables: number;
  pages?: number;
};

/**
 * One normalized text per document, Markdown-ish so the structure that tells a question from its
 * options survives: headings kept, lists as `- ` / `1. `, tables as pipe tables, page breaks as `---`.
 */
export type TExtractedDocument = {
  text: string;
  format: "markdown";
  stats: TExtractedDocumentStats;
  issues: TImportIssue[];
};

import { importError } from "../../../report";
import type { TImportSourceKind } from "../../../types";
import { extractCsv } from "./csv";
import { extractDocx } from "./docx";
import { failedDocument } from "./normalize";
import { extractPdf } from "./pdf";
import { extractPlainText } from "./text";
import type { TExtractedDocument } from "./types";
import { extractXlsx } from "./xlsx";

export type { TExtractedDocument, TExtractedDocumentStats } from "./types";
export { EXTRACT_MAX_CHARS, EXTRACT_TIMEOUT_MS, PAGE_BREAK } from "./types";

type TExtractor = (bytes: Buffer) => Promise<TExtractedDocument>;

const EXTRACTORS: Partial<Record<TImportSourceKind, TExtractor>> = {
  docx: extractDocx,
  pdf: extractPdf,
  markdown: extractPlainText,
  text: extractPlainText,
  csv: extractCsv,
  xlsx: extractXlsx,
};

/** Turns a supported document into one normalized Markdown-ish text. Pure: no AI, no HTTP. */
export async function extractDocumentText(
  kind: TImportSourceKind,
  bytes: Buffer
): Promise<TExtractedDocument> {
  const extractor = EXTRACTORS[kind];
  if (!extractor) {
    return failedDocument(
      importError({ code: "document_unreadable", vars: { detail: `no text extractor for ${kind} files` } })
    );
  }

  return extractor(bytes);
}

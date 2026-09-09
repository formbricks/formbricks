import { extractText } from "unpdf";
import { importError } from "../../../report";
import { extractionFailure, failedDocument, finishDocument, withTimeout } from "./normalize";
import { EXTRACT_TIMEOUT_MS, PAGE_BREAK, type TExtractedDocument } from "./types";

function isPasswordError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "PasswordException"
  );
}

/**
 * PDF → text per page joined with page breaks. No OCR: a scanned PDF yields no text and is reported
 * as such; an encrypted one is reported instead of prompting for a password.
 */
export async function extractPdf(bytes: Buffer): Promise<TExtractedDocument> {
  try {
    const { totalPages, text } = await withTimeout(
      extractText(new Uint8Array(bytes), { mergePages: false }),
      EXTRACT_TIMEOUT_MS
    );
    const pages = text.map((page) => page.replace(/[ \t]+\n/g, "\n").trim());
    const joined = pages.filter((page) => page.length > 0).join(PAGE_BREAK);

    if (joined.replace(/\s+/g, "").length === 0) {
      return failedDocument(importError({ code: "no_text_extracted", vars: { pages: totalPages } }));
    }

    return finishDocument(joined, [], totalPages);
  } catch (error) {
    if (isPasswordError(error)) {
      return failedDocument(importError({ code: "document_encrypted" }));
    }
    return failedDocument(extractionFailure(error));
  }
}

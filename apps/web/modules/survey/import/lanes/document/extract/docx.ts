import mammoth from "mammoth";
import { guardArchive } from "./archive";
import { htmlToMarkdown } from "./html-to-markdown";
import { extractionFailure, failedDocument, finishDocument, toPipeTable, withTimeout } from "./normalize";
import { EXTRACT_TIMEOUT_MS, type TExtractedDocument } from "./types";

/** Word page breaks become `---` so a multi-page questionnaire keeps its page boundaries. */
const STYLE_MAP = ["br[type='page'] => hr", "p[style-name='Title'] => h1:fresh"];

/**
 * DOCX → Markdown via mammoth's HTML (not `extractRawText`, which flattens lists and tables — and
 * bilingual questionnaires are usually two-column tables). The zip is inspected before mammoth
 * inflates it, and the parse is bounded by a timeout.
 */
export async function extractDocx(bytes: Buffer): Promise<TExtractedDocument> {
  const rejected = guardArchive(bytes);
  if (rejected) {
    return failedDocument(rejected);
  }

  try {
    const result = await withTimeout(
      mammoth.convertToHtml({ buffer: bytes }, { styleMap: STYLE_MAP }),
      EXTRACT_TIMEOUT_MS
    );
    return finishDocument(htmlToMarkdown(result.value, toPipeTable), []);
  } catch (error) {
    return failedDocument(extractionFailure(error));
  }
}

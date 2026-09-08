import { finishDocument } from "./normalize";
import type { TExtractedDocument } from "./types";

/** Markdown and plain text pass through normalization only; their structure is already textual. */
export async function extractPlainText(bytes: Buffer): Promise<TExtractedDocument> {
  return finishDocument(bytes.toString("utf8"), []);
}

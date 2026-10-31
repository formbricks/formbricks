import type { TSurveyImportFile } from "../core/sniff";
import { SURVEY_IMPORT_AI_MAX_SOURCE_CHARS, SURVEY_IMPORT_DOCUMENT_MAX_CHUNKS } from "../limits";
import { countDocumentChunks } from "./chunks";
import { documentLimitExceeded } from "./errors";
import type { TDocumentKind, TDocumentModel } from "./model";
import { readCsvDocument } from "./read-csv";
import { readSheetDocument } from "./read-sheet";
import { readWordDocument } from "./read-word";

/*
 * A document lane's read (`pipeline.ts` has the rest). It runs in the upload's worker thread
 * (`../core/upload-thread.ts`), so it loads nothing server-side: no AI, no database.
 */

/** A file the sniffer read as a document: a Word questionnaire, or an Excel or CSV question list. */
export type TDocumentUpload = Extract<TSurveyImportFile, { type: TDocumentKind }>;

export interface TPreparedDocumentImport {
  fileName: string;
  model: TDocumentModel;
}

/** Each kind of document's reader, each building the same model. */
const readDocument = (upload: TDocumentUpload): TDocumentModel => {
  switch (upload.type) {
    case "xlsx":
      return readSheetDocument(upload.archive);
    case "csv":
      return readCsvDocument(upload.text, upload.encoding);
    case "docx":
      return readWordDocument(upload.archive);
  }
};

/** Read a document into the model and hold it to the AI ceiling, before any AI call. */
export function prepareDocumentImport(upload: TDocumentUpload, fileName: string): TPreparedDocumentImport {
  const model = readDocument(upload);
  if (model.sourceChars > SURVEY_IMPORT_AI_MAX_SOURCE_CHARS) {
    throw documentLimitExceeded(
      "source_size",
      "file",
      `The file's text must not exceed ${SURVEY_IMPORT_AI_MAX_SOURCE_CHARS} characters`
    );
  }
  if (countDocumentChunks(model) > SURVEY_IMPORT_DOCUMENT_MAX_CHUNKS) {
    throw documentLimitExceeded("source_size", "file", "The file has more lines than one import can plan");
  }
  return { fileName, model };
}

import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import type { TSurveyImportLane } from "../core/lane";
import type { TSurveyImportFile } from "../core/sniff";
import type { TDocumentKind, TDocumentModel } from "./model";
import { type TPreparedDocumentImport, prepareDocumentImport, runDocumentImport } from "./pipeline";
import { readCsvDocument } from "./read-csv";
import { readSheetDocument } from "./read-sheet";
import { readWordDocument } from "./read-word";

/** A file the sniffer read as a document: a Word questionnaire, or an Excel or CSV question list. */
export type TDocumentUpload = Extract<TSurveyImportFile, { type: TDocumentKind }>;

/** What the stream route hands a document lane: the file as the sniffer read it, and its name. */
export type TDocumentImportInput = TDocumentUpload & { fileName: string };

/** Each kind of document's reader, each building the same model. */
const readDocument = (input: TDocumentImportInput): TDocumentModel => {
  switch (input.type) {
    case "xlsx":
      return readSheetDocument(input.archive);
    case "csv":
      return readCsvDocument(input.text, input.encoding);
    case "docx":
      return readWordDocument(input.archive);
  }
};

/**
 * A document lane (ENG-6852, ENG-6853): a questionnaire or question list in any layout, read by code
 * into the keyed model and planned with AI, every text copied from the file. It spends AI tokens, so it
 * is charged to Create with AI's bucket too.
 */
const documentImportLane = (
  kind: TDocumentKind
): TSurveyImportLane<TDocumentImportInput, TPreparedDocumentImport> => ({
  kind,
  usesAI: true,
  rateLimit: rateLimitConfigs.api.v3SurveyGenerate,
  prepare: (input) => prepareDocumentImport(readDocument(input), input.fileName),
  run: (params) => runDocumentImport(params),
});

/** The document lanes, one per kind of document, so a lane is picked by the sniffed type alone. */
export const DOCUMENT_IMPORT_LANES: Readonly<
  Record<TDocumentKind, TSurveyImportLane<TDocumentImportInput, TPreparedDocumentImport>>
> = {
  xlsx: documentImportLane("xlsx"),
  csv: documentImportLane("csv"),
  docx: documentImportLane("docx"),
};

export const isDocumentUpload = (upload: TSurveyImportFile): upload is TDocumentUpload =>
  Object.hasOwn(DOCUMENT_IMPORT_LANES, upload.type);

import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import type { TSurveyImportLane } from "../core/lane";
import type { TSurveyImportTextEncoding } from "../core/sniff";
import type { TZipArchive } from "../core/zip";
import type { TDocumentKind, TDocumentModel } from "./model";
import { type TPreparedDocumentImport, prepareDocumentImport, runDocumentImport } from "./pipeline";
import { readCsvDocument } from "./read-csv";
import { readSheetDocument } from "./read-sheet";
import { readWordDocument } from "./read-word";

/** What the stream route hands a document lane: the file as the sniffer read it, and its name. */
export type TDocumentImportInput = (
  | { type: "xlsx"; bytes: Uint8Array; archive: TZipArchive }
  | { type: "csv"; text: string; encoding: TSurveyImportTextEncoding }
  | { type: "docx"; archive: TZipArchive }
) & { fileName: string };

/** Each kind of document's reader, each building the same model. */
const readDocument = (input: TDocumentImportInput): TDocumentModel => {
  switch (input.type) {
    case "xlsx":
      return readSheetDocument(input.bytes, input.archive);
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

export const excelImportLane = documentImportLane("xlsx");
export const csvImportLane = documentImportLane("csv");
export const wordImportLane = documentImportLane("docx");

import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import type { TSurveyImportLane } from "../core/lane";
import type { TSurveyImportFile } from "../core/sniff";
import type { TDocumentKind } from "./model";
import { runDocumentImport } from "./pipeline";
import type { TDocumentUpload, TPreparedDocumentImport } from "./prepare";

/**
 * What the stream route hands a document lane: the read of the file (`prepareDocumentImport`), which
 * runs in the upload's thread once the lane's rate limit and AI gate have let it through.
 */
export interface TDocumentImportInput {
  read: () => Promise<TPreparedDocumentImport>;
}

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
  prepare: ({ read }) => read(),
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

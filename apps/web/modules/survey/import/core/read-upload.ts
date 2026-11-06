import { type TExcelExportRead, readExcelExport } from "@/modules/survey/excel-export/read";
import { type TFormbricksFileRead, readFormbricksFile } from "@/modules/survey/formbricks-file/read";
import type { TDocumentKind } from "../document/model";
import { type TPreparedDocumentImport, prepareDocumentImport } from "../document/prepare";
import { type TPreparedQsfImport, prepareQsfImport } from "../qsf/prepare";
import type { TSurveyImportFile } from "./sniff";

/**
 * An upload read as far as its lane reads it before the stream opens: a Formbricks file read and
 * checked, a Qualtrics export or a document read into its lane's model and held to the AI ceiling.
 * What the upload's worker thread hands back (`upload-thread.ts`), so it never holds the parsed file:
 * each is bounded by the lane's limits, while the parsed file is bounded only by the upload's.
 */
export type TSurveyImportUploadRead =
  | { type: "formbricks"; read: TFormbricksFileRead }
  | { type: "excel_export"; read: TExcelExportRead }
  | { type: "qsf"; prepared: TPreparedQsfImport }
  | { type: TDocumentKind; prepared: TPreparedDocumentImport };

/**
 * How an upload is read: as a file to bring in as a survey (`survey`), or as the survey's own Excel
 * export, read back by its layout rather than by AI (`excel_export`, ENG-6809), which only an `.xlsx`
 * can be.
 */
export type TSurveyImportReadAs = "survey" | "excel_export";

/**
 * Read a sniffed upload for its lane. Throws the lane's refusals: `SurveyImportInputError` (422) and
 * `SurveyImportFileTooLargeError` (413).
 */
export const readSurveyImportUpload = (
  upload: TSurveyImportFile,
  fileName: string,
  as: TSurveyImportReadAs = "survey"
): TSurveyImportUploadRead => {
  if (as === "excel_export") {
    if (upload.type !== "xlsx") throw new Error(`A ${upload.type} upload cannot be read as an Excel export`);
    return { type: "excel_export", read: readExcelExport(upload.archive) };
  }
  switch (upload.type) {
    case "formbricks":
      return { type: "formbricks", read: readFormbricksFile(upload.json) };
    case "qsf":
      return { type: "qsf", prepared: prepareQsfImport(upload.json, fileName) };
    case "xlsx":
    case "csv":
    case "docx":
      return { type: upload.type, prepared: prepareDocumentImport(upload, fileName) };
  }
};

import { EXCEL_EXPORT_META_SHEET } from "@/modules/survey/excel-export/format";
import {
  ExcelExportNotRecognizedError,
  type TExcelExportRead,
  excelExportFromBook,
  hasExcelExportMeta,
} from "@/modules/survey/excel-export/read";
import { type TFormbricksFileRead, readFormbricksFile } from "@/modules/survey/formbricks-file/read";
import type { TDocumentKind } from "../document/model";
import {
  type TPreparedDocumentImport,
  prepareDocumentImport,
  prepareDocumentModel,
} from "../document/prepare";
import { readCheckedWorkbook, sheetDocumentFromBook } from "../document/read-sheet";
import { type TPreparedQsfImport, prepareQsfImport } from "../qsf/prepare";
import { type TSurveyImportRefusal, toSurveyImportRefusal } from "./errors";
import type { TSurveyImportFile } from "./sniff";

/**
 * A workbook read for both of its lanes (ENG-6809), from one parse of the file: as a Formbricks Excel
 * export, when it has the export's meta sheet, and as a question list for the document import. The
 * route picks the lane once it knows whether the export's survey is one the user may update, so both
 * readings come back; a document reading that is refused travels as its refusal, thrown only if the
 * document lane is the one picked.
 */
export interface TSpreadsheetRead {
  type: "xlsx";
  excelExport: TExcelExportRead | null;
  document: { prepared: TPreparedDocumentImport } | { refusal: TSurveyImportRefusal };
}

/**
 * An upload read as far as its lane reads it before the stream opens: a Formbricks file read and
 * checked, a Qualtrics export or a document read into its lane's model and held to the AI ceiling.
 * What the upload's worker thread hands back (`upload-thread.ts`), so it never holds the parsed file:
 * each is bounded by the lane's limits, while the parsed file is bounded only by the upload's.
 */
export type TSurveyImportUploadRead =
  | { type: "formbricks"; read: TFormbricksFileRead }
  | { type: "qsf"; prepared: TPreparedQsfImport }
  | TSpreadsheetRead
  | { type: Exclude<TDocumentKind, "xlsx">; prepared: TPreparedDocumentImport };

/** The export reading of a workbook with the meta sheet; `null` when that sheet is not one this reads. */
const readExcelExportOf = (book: Parameters<typeof excelExportFromBook>[0]): TExcelExportRead | null => {
  if (!hasExcelExportMeta(book)) return null;
  try {
    return excelExportFromBook(book);
  } catch (error) {
    // A meta sheet of another format, or a sheet without its key column: an ordinary spreadsheet.
    if (error instanceof ExcelExportNotRecognizedError) return null;
    throw error;
  }
};

const readSpreadsheet = (
  upload: Extract<TSurveyImportFile, { type: "xlsx" }>,
  fileName: string
): TSpreadsheetRead => {
  // The first sheet and the export's meta sheet, parsed once: the zip guard counts every part it
  // inflates, so a second parse would count the file twice.
  const book = readCheckedWorkbook(upload.archive, [0, EXCEL_EXPORT_META_SHEET]);
  const excelExport = readExcelExportOf(book);
  try {
    return {
      type: "xlsx",
      excelExport,
      document: { prepared: prepareDocumentModel(sheetDocumentFromBook(book), fileName) },
    };
  } catch (error) {
    const refusal = toSurveyImportRefusal(error);
    if (!refusal) throw error;
    return { type: "xlsx", excelExport, document: { refusal } };
  }
};

/**
 * Read a sniffed upload for its lane. Throws the lane's refusals: `SurveyImportInputError` (422) and
 * `SurveyImportFileTooLargeError` (413).
 */
export const readSurveyImportUpload = (
  upload: TSurveyImportFile,
  fileName: string
): TSurveyImportUploadRead => {
  switch (upload.type) {
    case "formbricks":
      return { type: "formbricks", read: readFormbricksFile(upload.json) };
    case "qsf":
      return { type: "qsf", prepared: prepareQsfImport(upload.json, fileName) };
    case "xlsx":
      return readSpreadsheet(upload, fileName);
    case "csv":
    case "docx":
      return { type: upload.type, prepared: prepareDocumentImport(upload, fileName) };
  }
};

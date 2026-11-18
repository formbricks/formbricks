import {
  EXCEL_EXPORT_SHEETS,
  ExcelExportNotRecognizedError,
  type TExcelExportRead,
  excelExportFromBook,
  excelExportSurveyIdOf,
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
import { type TSurveyImportRefusal, fromSurveyImportRefusal, toSurveyImportRefusal } from "./errors";
import type { TSurveyImportFile } from "./sniff";

/** A reading of an upload that is either what its lane reads, or the refusal its lane answers with. */
export type TReadingOrRefusal<TRead> = TRead | { refusal: TSurveyImportRefusal };

/** A reading's value, for the lane that was picked; the refusal it carries is thrown there. */
export const readingOrThrow = <TRead extends object>(reading: TReadingOrRefusal<TRead>): TRead => {
  if ("refusal" in reading) throw fromSurveyImportRefusal(reading.refusal);
  return reading;
};

/**
 * A workbook read for both of its lanes (ENG-6809), from one parse of the file: as a Formbricks Excel
 * export, when its meta sheet is one, and as a question list for the document import. The route picks
 * the lane once it knows whether the export's survey is one the user may update, so both readings come
 * back, each with the refusal its lane would answer instead, thrown only if that lane is picked: an
 * export past the text cap is refused for its survey, and read as any spreadsheet otherwise.
 */
export interface TSpreadsheetRead {
  type: "xlsx";
  /** The survey the export names (untrusted), and its rows; `null` for a workbook that is no export. */
  excelExport: { surveyId: string; reading: TReadingOrRefusal<{ read: TExcelExportRead }> } | null;
  document: TReadingOrRefusal<{ prepared: TPreparedDocumentImport }>;
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

/** `read()`, or the refusal it threw; anything that is no refusal is thrown on. */
const readOrRefusal = <TRead>(read: () => TRead): TReadingOrRefusal<TRead> => {
  try {
    return read();
  } catch (error) {
    const refusal = toSurveyImportRefusal(error);
    if (!refusal) throw error;
    return { refusal };
  }
};

/** The export reading of a parsed workbook; `null` when its meta sheet is missing or not one this reads. */
const readExcelExportOf = (
  book: Parameters<typeof excelExportFromBook>[0]
): TSpreadsheetRead["excelExport"] => {
  try {
    const surveyId = excelExportSurveyIdOf(book);
    return { surveyId, reading: readOrRefusal(() => ({ read: excelExportFromBook(book) })) };
  } catch (error) {
    // A meta sheet of another format or past the sheet limits, or a texts sheet without its key column:
    // an ordinary spreadsheet, as far as the document import can read it.
    if (error instanceof ExcelExportNotRecognizedError || toSurveyImportRefusal(error)) return null;
    throw error;
  }
};

const readSpreadsheet = (
  upload: Extract<TSurveyImportFile, { type: "xlsx" }>,
  fileName: string
): TSpreadsheetRead => {
  // The first sheet and the export's meta sheet, parsed once: the zip guard counts every part it
  // inflates, so a second parse would count the file twice.
  const book = readCheckedWorkbook(upload.archive, EXCEL_EXPORT_SHEETS);
  return {
    type: "xlsx",
    excelExport: readExcelExportOf(book),
    document: readOrRefusal(() => ({
      prepared: prepareDocumentModel(sheetDocumentFromBook(book), fileName),
    })),
  };
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

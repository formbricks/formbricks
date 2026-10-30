import * as XLSX from "xlsx";
import {
  SurveyImportFileTooLargeError,
  SurveyImportInputError,
  surveyImportFileUnreadable,
} from "../core/errors";
import { type TZipArchive, XML_PART } from "../core/zip";
import {
  SURVEY_IMPORT_SHEET_MAX_CELL_CHARS,
  SURVEY_IMPORT_SHEET_MAX_COLUMNS,
  SURVEY_IMPORT_SHEET_MAX_ROWS,
} from "../limits";
import { documentLimitExceeded } from "./errors";
import { type TDocumentModel, buildGridModel, columnName } from "./model";
import { checkDocumentXml } from "./xml";

/**
 * The Excel reader of the document import (ENG-6852): the first sheet of a `.xlsx`, read with the
 * vendored SheetJS as text only — no formulas (a formula cell gives its last computed value), no HTML,
 * no styles, no macros — and held to the sheet limits. The other sheets are never parsed; the report
 * names them.
 *
 * SheetJS inflates the archive with its own inflater, which counts nothing. So every entry is first read
 * through the upload's zip guard (`core/zip.ts`), which counts what each one actually inflates to against
 * the zip limits and checks it is the size the directory declares: once that passed, what SheetJS
 * inflates is known to be within them. Each XML part is held to the XML limits there too — its depth,
 * its element count, no DTD — before SheetJS parses any.
 */

/** A sheet hidden so the user cannot unhide it from Excel: a file's own bookkeeping, not a sheet to name. */
const VERY_HIDDEN = 2;

/**
 * Read every entry once through the zip guard, so nothing inflates past the zip limits afterwards, and
 * hold every XML part to the XML limits (`xml.ts`): SheetJS parses them with none of its own.
 */
const checkArchive = (archive: TZipArchive): void => {
  for (const name of archive.names) {
    const bytes = archive.read(name);
    if (bytes !== null && XML_PART.test(name)) checkDocumentXml(bytes, name);
  }
};

const readWorkbook = (bytes: Uint8Array): XLSX.WorkBook => {
  try {
    return XLSX.read(bytes, {
      type: "array",
      dense: true,
      // The first sheet only; the others are named from the workbook's sheet list, never parsed.
      sheets: 0,
      // One row past the limit: SheetJS stops reading there and keeps the sheet's full range.
      sheetRows: SURVEY_IMPORT_SHEET_MAX_ROWS + 1,
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
      cellNF: false,
      cellDates: false,
      bookVBA: false,
    });
  } catch {
    throw surveyImportFileUnreadable("The workbook could not be read");
  }
};

/** The rows the sheet declares, whether or not they were read. */
const declaredRowCount = (sheet: XLSX.WorkSheet): number => {
  const range = sheet["!fullref"] ?? sheet["!ref"];
  return range ? XLSX.utils.decode_range(range).e.r + 1 : 0;
};

/** Where the sheet's used range starts, zero-based: the first row and column of `readRows`. */
const originOf = (sheet: XLSX.WorkSheet): { row: number; column: number } => {
  const range = sheet["!ref"];
  if (!range) return { row: 0, column: 0 };
  const { s } = XLSX.utils.decode_range(range);
  return { row: s.r, column: s.c };
};

/**
 * The sheet as rows of cell texts from its used range's first cell: what each cell shows (its
 * formatted value), held to the column and cell-size limits. Empty cells are empty strings.
 */
const readRows = (sheet: XLSX.WorkSheet, origin: { row: number; column: number }): string[][] => {
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true,
  });
  rows.forEach((row, rowIndex) => {
    let lastWithText = -1;
    row.forEach((text, columnIndex) => {
      if (text.length > SURVEY_IMPORT_SHEET_MAX_CELL_CHARS) {
        throw documentLimitExceeded(
          "cell_size",
          `file.${columnName(origin.column + columnIndex)}${origin.row + rowIndex + 1}`,
          `A cell must not exceed ${SURVEY_IMPORT_SHEET_MAX_CELL_CHARS} characters`
        );
      }
      if (text.trim() !== "") lastWithText = origin.column + columnIndex;
    });
    if (lastWithText >= SURVEY_IMPORT_SHEET_MAX_COLUMNS) {
      throw documentLimitExceeded(
        "columns",
        `file.R${origin.row + rowIndex + 1}`,
        `A row must not have more than ${SURVEY_IMPORT_SHEET_MAX_COLUMNS} columns`
      );
    }
  });
  return rows;
};

/** The workbook's other sheets, by name, in order: the ones a user can see or unhide. */
const skippedSheets = (book: XLSX.WorkBook): string[] =>
  book.SheetNames.slice(1).filter(
    (_name, index) => book.Workbook?.Sheets?.[index + 1]?.Hidden !== VERY_HIDDEN
  );

const titleOf = (book: XLSX.WorkBook): string | null => {
  const title = book.Props?.Title?.trim();
  return title ? title : null;
};

/**
 * Read a `.xlsx` (its bytes, and the archive the sniffer opened over them) into the document model.
 * Throws `SurveyImportFileTooLargeError` (413) past the zip limits, and `SurveyImportInputError` (422)
 * past the XML or sheet limits (`document_limit_exceeded`) or for a workbook that cannot be read,
 * declares a DTD, or whose first sheet has no text (`file_unreadable`).
 */
export const readSheetDocument = (bytes: Uint8Array, archive: TZipArchive): TDocumentModel => {
  checkArchive(archive);
  const book = readWorkbook(bytes);
  const firstName = book.SheetNames[0];
  const sheet = firstName === undefined ? undefined : book.Sheets[firstName];
  if (!sheet) throw surveyImportFileUnreadable("The workbook has no sheet");

  if (declaredRowCount(sheet) > SURVEY_IMPORT_SHEET_MAX_ROWS) {
    throw documentLimitExceeded(
      "rows",
      "file",
      `The sheet must not have more than ${SURVEY_IMPORT_SHEET_MAX_ROWS} rows`
    );
  }

  const origin = originOf(sheet);
  let rows: string[][];
  try {
    rows = readRows(sheet, origin);
  } catch (error) {
    if (error instanceof SurveyImportInputError || error instanceof SurveyImportFileTooLargeError)
      throw error;
    throw surveyImportFileUnreadable("The sheet could not be read");
  }

  const model = buildGridModel("xlsx", rows, {
    title: titleOf(book),
    skippedParts: skippedSheets(book),
    origin,
  });
  if (model.lines.length === 0) throw surveyImportFileUnreadable("The first sheet has no text");
  return model;
};

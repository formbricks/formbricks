import { type Zippable, zipSync } from "fflate";
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
import { checkDocumentXml, createXmlBudget } from "./xml";

/**
 * The Excel reader of the document import (ENG-6852): the first sheet of a `.xlsx`, read with the
 * vendored SheetJS as text only — no formulas (a formula cell gives its last computed value), no HTML,
 * no styles, no macros — and held to the sheet limits. The other sheets are never parsed; the report
 * names them.
 *
 * SheetJS inflates an archive with its own inflater, which counts nothing, and reads an archive its own
 * way: the entries "on this disk", each named and sized from its local header. So it never gets the
 * upload. Every entry is read through the upload's zip guard (`core/zip.ts`), which counts what each one
 * inflates to against the zip limits, and each XML part is held to the XML limits — its depth, its
 * element count, no DTD, one budget for the whole file. SheetJS then parses an archive rebuilt from
 * exactly those XML parts, stored uncompressed: nothing it reads is anything the guard has not read and
 * checked.
 */

/** A sheet hidden so the user cannot unhide it from Excel: a file's own bookkeeping, not a sheet to name. */
const VERY_HIDDEN = 2;

/**
 * The archive SheetJS parses: every XML part read once through the zip guard and held to the XML limits
 * (`xml.ts`), since SheetJS parses them with none of its own, and stored again as it came out. Stored, so
 * SheetJS copies rather than inflates; no larger than what the zip limits allow.
 */
const rebuildCheckedArchive = (archive: TZipArchive): Uint8Array => {
  // Null-prototype: an entry named `__proto__` is an ordinary key, not the object's prototype.
  const entries = Object.create(null) as Zippable;
  const budget = createXmlBudget();
  for (const name of archive.names) {
    // Only XML parts: SheetJS reads a workbook from them alone, and a picture, an embedded file or a
    // printer setting would only be copied twice more for nothing.
    if (!XML_PART.test(name)) continue;
    const bytes = archive.read(name);
    if (bytes === null) continue;
    checkDocumentXml(bytes, name, budget);
    entries[name] = bytes;
  }
  return zipSync(entries, { level: 0 });
};

const readWorkbook = (bytes: Uint8Array, sheets: number | (number | string)[]): XLSX.WorkBook => {
  try {
    return XLSX.read(bytes, {
      type: "array",
      dense: true,
      // Only the sheets asked for; the others are named from the workbook's sheet list, never parsed.
      sheets,
      // No `sheetRows`: SheetJS would stop reading there, and a row past it that the sheet's
      // `<dimension>` leaves out would be lost without a word. Read whole, every cell reaches the row
      // check in `textExtentOf`; the XML limits bound what is read.
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

/**
 * A `.xlsx` (the archive the sniffer opened) parsed by SheetJS through the upload's zip guard and the
 * XML limits, with only `sheets` parsed: by index, or by name.
 */
export const readCheckedWorkbook = (
  archive: TZipArchive,
  sheets: number | (number | string)[]
): XLSX.WorkBook => readWorkbook(rebuildCheckedArchive(archive), sheets);

/** Where the sheet's used range starts, zero-based: the first row and column of `readRows`. */
const originOf = (sheet: XLSX.WorkSheet): { row: number; column: number } => {
  const range = sheet["!ref"];
  if (!range) return { row: 0, column: 0 };
  const { s } = XLSX.utils.decode_range(range);
  return { row: s.r, column: s.c };
};

/**
 * The last row and column holding text, zero-based, from the cells SheetJS read — never from the range
 * the file declares, which its `<dimension>` sets to any width: one cell under `A1:XFD5000` would
 * otherwise be read as 82 million empty ones, and one that understates it would hide rows. Refuses text
 * at or past the row limit, and a row with text at or past the column limit; cells past either that
 * hold nothing are allowed, as Excel leaves formatted empty ones there. `null` for a
 * sheet with no text. Costs one pass over the cells read, which the XML limits bound.
 */
const textExtentOf = (sheet: XLSX.WorkSheet): { row: number; column: number } | null => {
  let lastRow = -1;
  let lastColumn = -1;
  // Dense mode: rows and cells by their absolute indices, holes where the file has none. Only the
  // indices present are visited: one cell at column XFD would make `forEach` walk all 16,384 slots of
  // its row, and the XML budget allows tens of thousands of such rows.
  const data = sheet["!data"] ?? [];
  Object.keys(data).forEach((rowKey) => {
    const rowIndex = Number(rowKey);
    const row = data[rowIndex];
    if (!row) return;
    Object.keys(row).forEach((columnKey) => {
      const columnIndex = Number(columnKey);
      const cell = row[columnIndex];
      // An error cell (`#N/A`) reads as empty, as `sheet_to_json` reads it.
      if (!cell || cell.t === "e" || XLSX.utils.format_cell(cell).trim() === "") return;
      if (rowIndex >= SURVEY_IMPORT_SHEET_MAX_ROWS) {
        throw documentLimitExceeded(
          "rows",
          "file",
          `The sheet must not have more than ${SURVEY_IMPORT_SHEET_MAX_ROWS} rows`
        );
      }
      if (columnIndex >= SURVEY_IMPORT_SHEET_MAX_COLUMNS) {
        throw documentLimitExceeded(
          "columns",
          `file.R${rowIndex + 1}`,
          `A row must not have more than ${SURVEY_IMPORT_SHEET_MAX_COLUMNS} columns`
        );
      }
      lastRow = Math.max(lastRow, rowIndex);
      lastColumn = Math.max(lastColumn, columnIndex);
    });
  });
  return lastRow < 0 ? null : { row: lastRow, column: lastColumn };
};

/**
 * The sheet as rows of cell texts from its used range's first cell to the last cell with text: what
 * each cell shows (its formatted value), held to the column and cell-size limits. Empty cells are empty
 * strings.
 */
const readRows = (sheet: XLSX.WorkSheet, origin: { row: number; column: number }): string[][] => {
  const extent = textExtentOf(sheet);
  if (!extent || extent.row < origin.row || extent.column < origin.column) return [];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true,
    range: { s: { r: origin.row, c: origin.column }, e: { r: extent.row, c: extent.column } },
  });
  rows.forEach((row, rowIndex) => {
    row.forEach((text, columnIndex) => {
      if (text.length > SURVEY_IMPORT_SHEET_MAX_CELL_CHARS) {
        throw documentLimitExceeded(
          "cell_size",
          `file.${columnName(origin.column + columnIndex)}${origin.row + rowIndex + 1}`,
          `A cell must not exceed ${SURVEY_IMPORT_SHEET_MAX_CELL_CHARS} characters`
        );
      }
    });
  });
  return rows;
};

/**
 * One parsed sheet as rows of cell texts, from its used range's first cell (`origin`, zero-based) to the
 * last cell with text, held to the sheet limits. Throws the same refusals as the document reader.
 */
export const readSheetText = (
  sheet: XLSX.WorkSheet
): { origin: { row: number; column: number }; rows: string[][] } => {
  const origin = originOf(sheet);
  try {
    return { origin, rows: readRows(sheet, origin) };
  } catch (error) {
    if (error instanceof SurveyImportInputError || error instanceof SurveyImportFileTooLargeError)
      throw error;
    throw surveyImportFileUnreadable("The sheet could not be read");
  }
};

/** The workbook's other sheets, by name, in order: the ones a user can see or unhide. */
const skippedSheets = (book: XLSX.WorkBook): string[] =>
  book.SheetNames.slice(1).filter(
    (_name, index) => book.Workbook?.Sheets?.[index + 1]?.Hidden !== VERY_HIDDEN
  );

const titleOf = (book: XLSX.WorkBook): string | null => {
  return book.Props?.Title?.trim() || null;
};

/**
 * Read a `.xlsx` (the archive the sniffer opened) into the document model.
 * Throws `SurveyImportFileTooLargeError` (413) past the zip limits, and `SurveyImportInputError` (422)
 * past the XML or sheet limits (`document_limit_exceeded`) or for a workbook that cannot be read,
 * declares a DTD, or whose first sheet has no text (`file_unreadable`).
 */
export const readSheetDocument = (archive: TZipArchive): TDocumentModel =>
  sheetDocumentFromBook(readCheckedWorkbook(archive, 0));

/** A workbook `readCheckedWorkbook` parsed, its first sheet at least, as the document model. */
export const sheetDocumentFromBook = (book: XLSX.WorkBook): TDocumentModel => {
  const firstName = book.SheetNames[0];
  const sheet = firstName === undefined ? undefined : book.Sheets[firstName];
  if (!sheet) throw surveyImportFileUnreadable("The workbook has no sheet");

  const { origin, rows } = readSheetText(sheet);

  const model = buildGridModel("xlsx", rows, {
    title: titleOf(book),
    skippedParts: skippedSheets(book),
    origin,
  });
  if (model.lines.length === 0) throw surveyImportFileUnreadable("The first sheet has no text");
  return model;
};

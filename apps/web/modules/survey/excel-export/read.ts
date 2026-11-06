import type * as XLSX from "xlsx";
import { SurveyImportInputError } from "@/modules/survey/import/core/errors";
import type { TZipArchive } from "@/modules/survey/import/core/zip";
import { readCheckedWorkbook, readSheetText } from "@/modules/survey/import/document/read-sheet";
import {
  EXCEL_EXPORT_FORMAT,
  EXCEL_EXPORT_KEY_HEADER,
  EXCEL_EXPORT_META_COLUMNS,
  EXCEL_EXPORT_META_FORMAT,
  EXCEL_EXPORT_META_HEADERS,
  EXCEL_EXPORT_META_LANGUAGES,
  EXCEL_EXPORT_META_LOCALE,
  EXCEL_EXPORT_META_SHEET,
} from "./format";

/**
 * Reading an Excel export back (ENG-6809): the texts sheet and the very hidden meta sheet of a file
 * `writeExcelExport` wrote, as the import into a survey needs them. No AI and no database: it runs in
 * the upload's worker thread, through the same zip guard, XML limits and sheet limits as the document
 * import, and only the first sheet and the meta sheet are parsed.
 *
 * Everything here is the user's file, and untrusted: keys, ids, codes, headers and texts are only ever
 * compared with the survey's own, or checked before they become one.
 */

/** One language column the meta sheet names, and where the texts sheet has it, if it still does. */
export interface TExcelExportLanguageColumn {
  /** The language's code, or `default` for a survey exported without languages. */
  code: string;
  /** Its zero-based column in the texts sheet; `null` when no header there reads as the export wrote it. */
  column: number | null;
}

/** One row of the texts sheet below its header, with any text in it. */
export interface TExcelExportRow {
  /** The row's number in the sheet, 1-based, as the user sees it. */
  row: number;
  /** The hidden key of an exported row; `""` on a row added in the sheet. */
  key: string;
  /** The Question ID and Type cells, trimmed. */
  questionId: string;
  type: string;
  /** Each found language's cell, by code. An empty cell is `""`. */
  cells: Map<string, string>;
}

export interface TExcelExportRead {
  languages: TExcelExportLanguageColumn[];
  /** The locale the export wrote its Type cells in, to read a type or a field back by its name. */
  locale: string;
  rows: TExcelExportRow[];
  /** Rows whose key an earlier row already has: the first one is read. 1-based. */
  duplicateRows: number[];
}

/** The refusal for a workbook that is not an Excel export of a survey: no meta sheet, or not ours. */
export const excelExportNotRecognized = (reason: string): SurveyImportInputError =>
  new SurveyImportInputError(
    [{ name: "file", reason, code: "excel_export_not_recognized" }],
    "The file is not an Excel export of a survey."
  );

const cell = (rows: string[][], row: number, column: number): string => rows[row]?.[column] ?? "";

interface TMeta {
  languages: { code: string; header: string }[];
  questionIdHeader: string;
  typeHeader: string;
  locale: string;
}

/** The meta sheet, read from A1, or a refusal when it is missing, moved or of another format. */
const readMeta = (book: XLSX.WorkBook): TMeta => {
  const sheet = book.Sheets[EXCEL_EXPORT_META_SHEET];
  if (!sheet) throw excelExportNotRecognized("The workbook has no Formbricks export sheet");
  const { origin, rows } = readSheetText(sheet);
  if (
    origin.row !== 0 ||
    origin.column !== 0 ||
    cell(rows, 0, 0) !== EXCEL_EXPORT_META_FORMAT ||
    cell(rows, 0, 1) !== String(EXCEL_EXPORT_FORMAT) ||
    cell(rows, 1, 0) !== EXCEL_EXPORT_META_LANGUAGES ||
    cell(rows, 2, 0) !== EXCEL_EXPORT_META_HEADERS ||
    cell(rows, 3, 0) !== EXCEL_EXPORT_META_COLUMNS ||
    cell(rows, 4, 0) !== EXCEL_EXPORT_META_LOCALE
  ) {
    throw excelExportNotRecognized("The Formbricks export sheet is not in a format this version reads");
  }

  const languages: { code: string; header: string }[] = [];
  for (let column = 1; column < (rows[1]?.length ?? 0); column += 1) {
    const code = cell(rows, 1, column).trim();
    if (!code) break;
    languages.push({ code, header: cell(rows, 2, column) });
  }
  if (languages.length === 0) throw excelExportNotRecognized("The Formbricks export sheet names no language");
  if (new Set(languages.map(({ code }) => code)).size !== languages.length) {
    throw excelExportNotRecognized("The Formbricks export sheet names a language twice");
  }
  return {
    languages,
    questionIdHeader: cell(rows, 3, 1),
    typeHeader: cell(rows, 3, 2),
    locale: cell(rows, 4, 1).trim(),
  };
};

/** The zero-based column whose header reads `header` exactly, past the key column; `null` if none does. */
const findColumn = (header: readonly string[], text: string): number | null => {
  if (!text) return null;
  const index = header.findIndex((cellText, column) => column > 0 && cellText === text);
  return index < 0 ? null : index;
};

/**
 * Read an Excel export (the archive the sniffer opened). Throws `SurveyImportInputError` (422) for a
 * workbook that is not one (`excel_export_not_recognized`), or that is past the sheet or XML limits,
 * and `SurveyImportFileTooLargeError` (413) past the zip limits.
 *
 * The texts sheet is the first one, with the key column at A and its header row where A reads `key`.
 * The other columns are found by their headers, as exported, so they may be moved; a language column
 * whose header was changed is reported, not guessed.
 */
export const readExcelExport = (archive: TZipArchive): TExcelExportRead => {
  const book = readCheckedWorkbook(archive, [0, EXCEL_EXPORT_META_SHEET]);
  const meta = readMeta(book);

  const firstName = book.SheetNames[0];
  const textsSheet = firstName === undefined ? undefined : book.Sheets[firstName];
  if (!textsSheet || firstName === EXCEL_EXPORT_META_SHEET) {
    throw excelExportNotRecognized("The workbook has no texts sheet");
  }
  const { origin, rows } = readSheetText(textsSheet);
  // The key column is the sheet's first: a used range that starts further right has none.
  const headerIndex = origin.column === 0 ? rows.findIndex((row) => row[0] === EXCEL_EXPORT_KEY_HEADER) : -1;
  if (headerIndex < 0) throw excelExportNotRecognized("The texts sheet has no key column");
  const header = rows[headerIndex];

  const languages = meta.languages.map(({ code, header: exported }) => ({
    code,
    column: findColumn(header, exported),
  }));
  const questionIdColumn = findColumn(header, meta.questionIdHeader);
  const typeColumn = findColumn(header, meta.typeHeader);

  const read: TExcelExportRead = { languages, locale: meta.locale, rows: [], duplicateRows: [] };
  const seen = new Set<string>();
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row.some((text) => text.trim() !== "")) continue;
    const sheetRow = origin.row + index + 1;
    const key = row[0]?.trim() ?? "";
    if (key) {
      if (seen.has(key)) {
        read.duplicateRows.push(sheetRow);
        continue;
      }
      seen.add(key);
    }
    const cells = new Map<string, string>();
    for (const { code, column } of languages) {
      if (column !== null) cells.set(code, row[column] ?? "");
    }
    read.rows.push({
      row: sheetRow,
      key,
      questionId: questionIdColumn === null ? "" : (row[questionIdColumn] ?? "").trim(),
      type: typeColumn === null ? "" : (row[typeColumn] ?? "").trim(),
      cells,
    });
  }
  return read;
};

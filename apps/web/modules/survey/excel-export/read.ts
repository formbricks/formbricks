import type * as XLSX from "xlsx";
import { documentLimitExceeded } from "@/modules/survey/import/document/errors";
import { readSheetText } from "@/modules/survey/import/document/read-sheet";
import { EXCEL_EXPORT_KEY_HEADER, EXCEL_EXPORT_META_SHEET, isExcelExportMetaLayout } from "./format";
import { EXCEL_EXPORT_IMPORT_MAX_TEXT_CHARS } from "./limits";

/**
 * Reading an Excel export back (ENG-6809): the texts sheet and the very hidden meta sheet of a file
 * `writeExcelExport` wrote, as the import of an Excel export needs them. No AI and no database: it runs in
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
  /**
   * The survey the file says it was exported from: untrusted, so only ever looked up as the Update
   * would authorize it, and never used before that.
   */
  surveyId: string;
  /** When that survey was last changed, as exported (ISO 8601): what an Update checks it against. */
  updatedAt: string;
  rows: TExcelExportRow[];
  /** Rows whose key an earlier row already has: the first one is read. 1-based. */
  duplicateRows: number[];
}

/**
 * A workbook that is not an Excel export this version reads: no meta sheet, one of another format, or no
 * key column. Not a refusal: the import reads such a workbook as any other spreadsheet.
 */
export class ExcelExportNotRecognizedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ExcelExportNotRecognizedError";
  }
}

const excelExportNotRecognized = (reason: string) => new ExcelExportNotRecognizedError(reason);

const cell = (rows: string[][], row: number, column: number): string => rows[row]?.[column] ?? "";

interface TMeta {
  languages: { code: string; header: string }[];
  questionIdHeader: string;
  typeHeader: string;
  locale: string;
  surveyId: string;
  updatedAt: string;
}

/** An ISO 8601 instant as the export wrote it, or a refusal: the file is untrusted. */
const toIsoInstant = (text: string): string => {
  const time = Date.parse(text);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(text) || Number.isNaN(time)) {
    throw excelExportNotRecognized("The Formbricks export sheet's export time is not a date");
  }
  return new Date(time).toISOString();
};

/** The meta sheet, read from A1, or a refusal when it is missing, moved or of another format. */
const readMeta = (book: XLSX.WorkBook): TMeta => {
  const sheet = book.Sheets[EXCEL_EXPORT_META_SHEET];
  if (!sheet) throw excelExportNotRecognized("The workbook has no Formbricks export sheet");
  const { origin, rows } = readSheetText(sheet);
  if (
    origin.row !== 0 ||
    origin.column !== 0 ||
    !isExcelExportMetaLayout((row, column) => cell(rows, row, column))
  ) {
    throw excelExportNotRecognized("The Formbricks export sheet is not in a format this version reads");
  }

  const languages: { code: string; header: string }[] = [];
  for (let column = 1; column < (rows[1]?.length ?? 0); column += 1) {
    const code = cell(rows, 1, column).trim();
    if (!code) break;
    languages.push({ code, header: cell(rows, 2, column) });
  }
  if (new Set(languages.map(({ code }) => code)).size !== languages.length) {
    throw excelExportNotRecognized("The Formbricks export sheet names a language twice");
  }
  return {
    languages,
    questionIdHeader: cell(rows, 3, 1),
    typeHeader: cell(rows, 3, 2),
    locale: cell(rows, 4, 1).trim(),
    surveyId: cell(rows, 5, 1).trim(),
    updatedAt: toIsoInstant(cell(rows, 6, 1).trim()),
  };
};

/** The zero-based column whose header reads `header` exactly, past the key column; `null` if none does. */
const findColumn = (header: readonly string[], text: string): number | null => {
  if (!text) return null;
  const index = header.findIndex((cellText, column) => column > 0 && cellText === text);
  return index < 0 ? null : index;
};

/** The sheets `excelExportFromBook` reads, for `readCheckedWorkbook` to parse: the texts and the meta. */
export const EXCEL_EXPORT_SHEETS = [0, EXCEL_EXPORT_META_SHEET];

/**
 * The survey a parsed workbook's meta sheet names, as the file says it: untrusted. Throws
 * `ExcelExportNotRecognizedError` for a workbook whose meta sheet is missing or not this version's.
 */
export const excelExportSurveyIdOf = (book: XLSX.WorkBook): string => readMeta(book).surveyId;

/**
 * A workbook `readCheckedWorkbook` parsed (`EXCEL_EXPORT_SHEETS`) read as an Excel export. Throws
 * `ExcelExportNotRecognizedError` for a workbook that is not one, and `SurveyImportInputError` (422) for
 * one past the sheet limits or the text cap.
 *
 * The texts sheet is the first one, with the key column at A and its header row where A reads `key`.
 * The other columns are found by their headers, as exported, so they may be moved; a language column
 * whose header was changed is reported, not guessed.
 */
export const excelExportFromBook = (book: XLSX.WorkBook): TExcelExportRead => {
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
  return {
    languages,
    locale: meta.locale,
    surveyId: meta.surveyId,
    updatedAt: meta.updatedAt,
    ...readTextRows({
      rows: rows.slice(headerIndex + 1),
      firstRow: origin.row + headerIndex + 2,
      languages,
      questionIdColumn: findColumn(header, meta.questionIdHeader),
      typeColumn: findColumn(header, meta.typeHeader),
    }),
  };
};

/**
 * A counter of the text kept from the sheet's cells, against the import's ceiling: `keep` returns its
 * text, or refuses the sheet past it.
 */
const createTextBudget = (): ((text: string) => string) => {
  let chars = 0;
  return (text) => {
    chars += text.length;
    if (chars > EXCEL_EXPORT_IMPORT_MAX_TEXT_CHARS) {
      throw documentLimitExceeded(
        "text_size",
        "file",
        `The sheet's cells must not hold more than ${EXCEL_EXPORT_IMPORT_MAX_TEXT_CHARS} characters together`
      );
    }
    return text;
  };
};

/** The texts sheet's rows under its header, as the import reads them; empty rows are left out. */
const readTextRows = ({
  rows,
  firstRow,
  languages,
  questionIdColumn,
  typeColumn,
}: {
  rows: string[][];
  /** The 1-based sheet row of `rows[0]`. */
  firstRow: number;
  languages: TExcelExportLanguageColumn[];
  questionIdColumn: number | null;
  typeColumn: number | null;
}): Pick<TExcelExportRead, "rows" | "duplicateRows"> => {
  const read: Pick<TExcelExportRead, "rows" | "duplicateRows"> = { rows: [], duplicateRows: [] };
  const keep = createTextBudget();
  const seen = new Set<string>();
  const cellOf = (row: string[], column: number | null): string =>
    column === null ? "" : keep((row[column] ?? "").trim());

  rows.forEach((row, index) => {
    if (!row.some((text) => text.trim() !== "")) return;
    const sheetRow = firstRow + index;
    const key = row[0]?.trim() ?? "";
    if (key && seen.has(key)) {
      read.duplicateRows.push(sheetRow);
      return;
    }
    if (key) seen.add(key);
    const cells = new Map<string, string>();
    for (const { code, column } of languages) {
      if (column !== null) cells.set(code, keep(row[column] ?? ""));
    }
    read.rows.push({
      row: sheetRow,
      key,
      questionId: cellOf(row, questionIdColumn),
      type: cellOf(row, typeColumn),
      cells,
    });
  });
  return read;
};

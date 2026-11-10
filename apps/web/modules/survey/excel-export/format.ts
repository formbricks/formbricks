/**
 * The layout of the Excel export (ADR 0027), shared by its writer and its reader. Everything here is
 * read by code, so never translated.
 *
 * The texts sheet comes first: a hidden key column (header `key`), then Question ID, Type, one column
 * per language and Logic. The very hidden meta sheet tells an import how to read it back, by header,
 * so columns may be moved:
 *
 * | `format`    | `1`                                                                     |
 * | `languages` | each language column's code (`default` for a survey without languages) |
 * | `headers`   | each language column's header, in the same order                       |
 * | `columns`   | the Question ID column's header, then the Type column's                |
 * | `locale`    | the locale the headers and Type cells are written in                   |
 * | `surveyId`  | the survey the file was exported from                                  |
 * | `updatedAt` | when that survey was last changed, as exported (ISO 8601)              |
 *
 * The visible Survey sheet, after Questions, holds the survey's properties for people; the import
 * never reads it.
 */

/**
 * The export's own version, written to the meta sheet; raised when its layout changes. 1 was 6.2's, whose
 * meta sheet held only `surveyId`, `updatedAt` and `format`: too little to map the columns back, so this
 * version reads it as any spreadsheet.
 */
export const EXCEL_EXPORT_FORMAT = 2;

export const EXCEL_EXPORT_META_SHEET = "formbricks";
export const EXCEL_EXPORT_KEY_HEADER = "key";
export const EXCEL_EXPORT_META_FORMAT = "format";
export const EXCEL_EXPORT_META_LANGUAGES = "languages";
export const EXCEL_EXPORT_META_HEADERS = "headers";
export const EXCEL_EXPORT_META_COLUMNS = "columns";
export const EXCEL_EXPORT_META_LOCALE = "locale";
export const EXCEL_EXPORT_META_SURVEY_ID = "surveyId";
export const EXCEL_EXPORT_META_UPDATED_AT = "updatedAt";

/** The meta sheet's labels, one per row from A1 down, in this order: what tells a workbook is an export. */
export const EXCEL_EXPORT_META_ROWS = [
  EXCEL_EXPORT_META_FORMAT,
  EXCEL_EXPORT_META_LANGUAGES,
  EXCEL_EXPORT_META_HEADERS,
  EXCEL_EXPORT_META_COLUMNS,
  EXCEL_EXPORT_META_LOCALE,
  EXCEL_EXPORT_META_SURVEY_ID,
  EXCEL_EXPORT_META_UPDATED_AT,
] as const;

/**
 * Whether a meta sheet reads as this version's: the labels down column A in order, this format beside
 * `format`, and a language beside `languages`. `cellAt` gives a cell's text by zero-based row and column.
 * The one rule the server's reader and the import dialog's check in the browser share.
 */
export const isExcelExportMetaLayout = (cellAt: (row: number, column: number) => string): boolean =>
  EXCEL_EXPORT_META_ROWS.every((label, row) => cellAt(row, 0) === label) &&
  cellAt(0, 1) === String(EXCEL_EXPORT_FORMAT) &&
  cellAt(EXCEL_EXPORT_META_ROWS.indexOf(EXCEL_EXPORT_META_LANGUAGES), 1).trim() !== "";

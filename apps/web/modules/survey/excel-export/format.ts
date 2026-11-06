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
 */

/** The export's own version, written to the meta sheet; raised when its layout changes. */
export const EXCEL_EXPORT_FORMAT = 1;

export const EXCEL_EXPORT_META_SHEET = "formbricks";
export const EXCEL_EXPORT_KEY_HEADER = "key";
export const EXCEL_EXPORT_META_FORMAT = "format";
export const EXCEL_EXPORT_META_LANGUAGES = "languages";
export const EXCEL_EXPORT_META_HEADERS = "headers";
export const EXCEL_EXPORT_META_COLUMNS = "columns";
export const EXCEL_EXPORT_META_LOCALE = "locale";

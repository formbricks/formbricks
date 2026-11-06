import { type TCsvCell, toCsvLine } from "../utils/file-conversion";

/** The UTF-8 byte order mark. Excel needs it to read Arabic; SPSS reads it with `/ENCODING='UTF8'`. */
export const CSV_BOM = "\uFEFF";

/** Any line break, including the Unicode ones: none of them may survive inside a CSV cell. */
const LINE_BREAKS = /\r\n|[\r\n\u0085\u2028\u2029]/g;

/**
 * One CSV record of the Analysis export. Same rules as the attachment manifest's `toCsvLine`
 * (text always quoted, numbers bare, formula guard on text only, CRLF) with one difference: a line
 * break inside a cell becomes a space, because SPSS cannot read a record that spans lines. The Excel
 * file keeps the line breaks.
 */
export const analysisCsvLine = (cells: readonly TCsvCell[]): string =>
  toCsvLine(cells.map((cell) => (typeof cell === "string" ? cell.replace(LINE_BREAKS, " ") : cell)));

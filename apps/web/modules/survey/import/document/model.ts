/**
 * The keyed model every document reader builds (ENG-6852): the file as lines of cells in reading order,
 * each cell's text under a key the reader gave it. A sheet's line is a row (`R12`) and its cells are
 * addressed as Excel does (`C12`); a CSV is read as one sheet. The AI plans over these keys and the
 * assembly copies every text from here by key, so nothing the AI writes becomes survey text.
 *
 * A Word file (ENG-6853) is read into the same model: a paragraph is a line of one cell, both keyed by
 * its place among the body's paragraphs (`P12`); a table row is a line (`T2R3`) whose cells are keyed by
 * their column (`T2R3C1`). The rest of the lane reads it unchanged.
 */
import type { TSurveyImportTextEncoding } from "../core/sniff";

export type TDocumentKind = "xlsx" | "csv" | "docx";

export interface TDocumentCell {
  /** Unique in the document: `C12`. */
  key: string;
  /** The text as the file has it, never empty or blank. */
  text: string;
}

export interface TDocumentLine {
  /** Unique in the document: `R12`. */
  key: string;
  /** The line's cells with text, in reading order. */
  cells: TDocumentCell[];
  /**
   * The table the line is a row of (`T2`), in a document of flowing text: a Word file's table, which
   * holds a question laid out as a grid, or a whole questionnaire. Absent for a sheet's rows.
   */
  table?: string;
}

export interface TDocumentModel {
  kind: TDocumentKind;
  /** The title the file itself declares (a workbook's Title property), when it has one. */
  title: string | null;
  /** Parts of the file the import does not read, by the name the user knows them by: other sheets. */
  skippedParts: string[];
  /** Lines with text, in reading order. */
  lines: TDocumentLine[];
  /** Every cell's text by key. */
  cells: ReadonlyMap<string, string>;
  /** Characters of every cell together: what the AI would read. */
  sourceChars: number;
  /** How a text file was decoded, for the report; `null` for a file that is not text (a workbook). */
  encoding: TSurveyImportTextEncoding | null;
  /** Pictures, drawings and embedded objects in the file, which the import does not bring in. */
  images: number;
}

/** The model of `lines`, read in order: every cell's text by key, and their characters together. */
export const buildDocumentModel = (
  kind: TDocumentKind,
  lines: TDocumentLine[],
  {
    title = null,
    skippedParts = [],
    encoding = null,
    images = 0,
  }: {
    title?: string | null;
    skippedParts?: string[];
    encoding?: TSurveyImportTextEncoding | null;
    images?: number;
  } = {}
): TDocumentModel => {
  const cells = new Map<string, string>();
  let sourceChars = 0;
  for (const line of lines) {
    for (const cell of line.cells) {
      cells.set(cell.key, cell.text);
      sourceChars += cell.text.length;
    }
  }
  return { kind, title, skippedParts, lines, cells, sourceChars, encoding, images };
};

/** `A` for column 0, `Z`, `AA`, … as Excel names columns. */
export const columnName = (index: number): string => {
  let name = "";
  for (let rest = index + 1; rest > 0; rest = Math.floor((rest - 1) / 26)) {
    name = String.fromCodePoint(65 + ((rest - 1) % 26)) + name;
  }
  return name;
};

/**
 * The model of a grid of cell texts, row by row: one line per row with text, its cells addressed
 * `<column><row>`. `origin` is where the grid starts in the sheet, zero-based, so a sheet whose used
 * range starts at `B3` keeps the addresses the user sees.
 */
export const buildGridModel = (
  kind: TDocumentKind,
  rows: readonly (readonly string[])[],
  {
    title = null,
    skippedParts = [],
    origin = { row: 0, column: 0 },
    encoding = null,
  }: {
    title?: string | null;
    skippedParts?: string[];
    origin?: { row: number; column: number };
    encoding?: TSurveyImportTextEncoding | null;
  } = {}
): TDocumentModel => {
  const lines: TDocumentLine[] = [];

  rows.forEach((row, rowIndex) => {
    const lineCells: TDocumentCell[] = [];
    row.forEach((text, columnIndex) => {
      if (text.trim() === "") return;
      lineCells.push({ key: `${columnName(origin.column + columnIndex)}${origin.row + rowIndex + 1}`, text });
    });
    if (lineCells.length > 0) lines.push({ key: `R${origin.row + rowIndex + 1}`, cells: lineCells });
  });

  return buildDocumentModel(kind, lines, { title, skippedParts, encoding });
};

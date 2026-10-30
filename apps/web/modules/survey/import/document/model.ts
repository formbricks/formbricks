/**
 * The keyed model every document reader builds (ENG-6852): the file as lines of cells in reading order,
 * each cell's text under a key the reader gave it. A sheet's line is a row (`R12`) and its cells are
 * addressed as Excel does (`C12`); a CSV is read as one sheet. The AI plans over these keys and the
 * assembly copies every text from here by key, so nothing the AI writes becomes survey text.
 *
 * A reader of another kind of document (a Word file's paragraphs and table rows) builds the same model,
 * and the rest of the lane reads it unchanged.
 */

export type TDocumentKind = "xlsx" | "csv";

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
}

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
  }: { title?: string | null; skippedParts?: string[]; origin?: { row: number; column: number } } = {}
): TDocumentModel => {
  const lines: TDocumentLine[] = [];
  const cells = new Map<string, string>();
  let sourceChars = 0;

  rows.forEach((row, rowIndex) => {
    const lineCells: TDocumentCell[] = [];
    row.forEach((text, columnIndex) => {
      if (text.trim() === "") return;
      const key = `${columnName(origin.column + columnIndex)}${origin.row + rowIndex + 1}`;
      lineCells.push({ key, text });
      cells.set(key, text);
      sourceChars += text.length;
    });
    if (lineCells.length > 0) lines.push({ key: `R${origin.row + rowIndex + 1}`, cells: lineCells });
  });

  return { kind, title, skippedParts, lines, cells, sourceChars };
};

import { dataHeaderCells, dataParts } from "./data-files";
import { DATAMAP_HEADERS, buildDatamap } from "./datamap";
import type { TAnalysisCell, TAnalysisExport, TAnswerDisplay } from "./types";
import { UNMAPPED_HEADERS, buildUnmappedValuesTable, unmappedColumnNames } from "./unmapped-values";
import { XlsxLimitError, createXlsxWorkbook } from "./xlsx-writer";

export type TAnalysisFileOptions = {
  /** What the export was opened with (`openAnalysisExport({ answers })`): which tables the rows carry. */
  display: TAnswerDisplay;
  /** The zone the Timestamp column is written in. Only the SPSS syntax mentions it. Default UTC. */
  timeZone?: string;
};

export const rowCells = (
  row: { codes: TAnalysisCell[] | null; labels: TAnalysisCell[] | null },
  kind: "codes" | "labels"
): TAnalysisCell[] => {
  const cells = row[kind];
  if (!cells) {
    throw new Error(
      `The export rows carry no ${kind}: open the export with the same answers option as the writer`
    );
  }
  return cells;
};

export type TAnalysisWorkbookOptions = TAnalysisFileOptions & {
  /**
   * Refuses to build a workbook with more cells than this (every position of every sheet, blank or
   * not): it is held whole in memory. Checked from the counts before any row is read, and again as
   * rows arrive. Throws `XlsxLimitError`. No cap by default.
   */
  maxCells?: number;
};

/**
 * The Excel file of an Analysis export: sheets Labels and Codes (one or both, as Display answers
 * says), then Datamap and Unmapped values. Built whole in memory, by nature of the format; set
 * `maxCells` to cap it.
 */
export const buildAnalysisWorkbook = async (
  exported: TAnalysisExport,
  { display, maxCells }: TAnalysisWorkbookOptions
): Promise<Buffer> => {
  const workbook = createXlsxWorkbook();
  const parts = dataParts(display).map((part) => ({
    part,
    sheet: workbook.addSheet(part.sheet, dataHeaderCells(exported.columns, display, part.kind)),
  }));

  const tooBig = (cells: number): XlsxLimitError =>
    new XlsxLimitError(`The workbook would hold ${cells} cells, more than the ${maxCells} allowed`);
  if (maxCells !== undefined) {
    const expected = parts.length * exported.columns.length * (exported.counts.included + 1);
    if (expected > maxCells) throw tooBig(expected);
  }

  for await (const batch of exported.rows()) {
    for (const row of batch) {
      for (const { part, sheet } of parts) sheet.addRow(rowCells(row, part.kind));
    }
    if (maxCells !== undefined && workbook.cellCount() > maxCells) throw tooBig(workbook.cellCount());
  }

  const summary = exported.summary();
  const datamap = workbook.addSheet("Datamap", DATAMAP_HEADERS);
  for (const row of buildDatamap(exported.columns, { unmappedColumns: unmappedColumnNames(summary) })) {
    datamap.addRow(row);
  }
  const unmapped = workbook.addSheet("Unmapped values", UNMAPPED_HEADERS);
  for (const row of buildUnmappedValuesTable(summary)) unmapped.addRow(row);

  return workbook.toBuffer();
};

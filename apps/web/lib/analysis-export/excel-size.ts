/**
 * How big an Excel workbook of an Analysis export is, in cells. Pure, so the route (which refuses an
 * oversized workbook and tells the modal beforehand) and the writer count the same way.
 */
import { dataParts } from "./data-files";
import type { TAnswerDisplay } from "./types";

/**
 * Cells of the data sheets: every position, the header row and blank cells included, over one sheet
 * (Text only, Code only) or two (Text and code). The Datamap and Unmapped values sheets are small and
 * left out.
 */
export const analysisWorkbookCells = ({
  display,
  columns,
  responses,
}: {
  display: TAnswerDisplay;
  columns: number;
  responses: number;
}): number => dataParts(display).length * columns * (responses + 1);

export type TExcelSizeVerdict = {
  cells: number;
  /** `null`: no cap is set. */
  maxCells: number | null;
  tooLarge: boolean;
};

export const excelSizeVerdict = (cells: number, maxCells: number | undefined): TExcelSizeVerdict => ({
  cells,
  maxCells: maxCells ?? null,
  tooLarge: maxCells !== undefined && cells > maxCells,
});

/**
 * What the modal needs to size the workbook of a column selection without asking again: the sheets, the
 * responses, and how many columns each Include columns entry holds (the options of a multi-select, a whole
 * question otherwise). The server sends it with the all-columns verdict.
 */
export type TExcelSizing = {
  parts: number;
  responses: number;
  columnsByEntry: Record<string, number>;
};

/** The verdict once only the entries in `keptEntryIds` are left: the same count `analysisWorkbookCells` makes. */
export const excelVerdictForEntries = (
  excel: TExcelSizeVerdict,
  sizing: TExcelSizing,
  keptEntryIds: readonly string[]
): TExcelSizeVerdict => {
  const columns = keptEntryIds.reduce((sum, id) => sum + (sizing.columnsByEntry[id] ?? 0), 0);
  const cells = sizing.parts * columns * (sizing.responses + 1);
  return { cells, maxCells: excel.maxCells, tooLarge: excel.maxCells !== null && cells > excel.maxCells };
};

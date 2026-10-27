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

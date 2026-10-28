import { dataHeaderCells, dataParts } from "./data-files";
import { DATAMAP_HEADERS, buildDatamap } from "./datamap";
import { analysisWorkbookCells } from "./excel-size";
import type { TAnalysisCell, TAnalysisExport, TAnswerDisplay } from "./types";
import { UNMAPPED_HEADERS, buildUnmappedValuesTable, unmappedColumnNames } from "./unmapped-values";
import { XlsxLimitError, createXlsxWorkbook } from "./xlsx-writer";

export type TAnalysisFileOptions = {
  /** What the export was opened with (`openAnalysisExport({ answers })`): which tables the rows carry. */
  display: TAnswerDisplay;
  /** "Display questions", the header cells (see `dataHeaderCells`). Left out: the headers follow `display`. */
  questions?: TAnswerDisplay;
  /** The zone the Timestamp column is written in. Only the SPSS syntax mentions it. Default UTC. */
  timeZone?: string;
  /** Which extras come with the data tables. Each is on unless set to `false`. */
  include?: { datamap?: boolean; unmappedValues?: boolean; spssSyntax?: boolean };
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

type TWorkbook = ReturnType<typeof createXlsxWorkbook>;

const addDatamapSheet = (workbook: TWorkbook, exported: TAnalysisExport): void => {
  const datamap = workbook.addSheet("Datamap", DATAMAP_HEADERS);
  const unmappedColumns = unmappedColumnNames(exported.summary());
  for (const row of buildDatamap(exported.columns, { unmappedColumns })) datamap.addRow(row);
};

const addUnmappedSheet = (workbook: TWorkbook, exported: TAnalysisExport): void => {
  const unmapped = workbook.addSheet("Unmapped values", UNMAPPED_HEADERS);
  for (const row of buildUnmappedValuesTable(exported.summary())) unmapped.addRow(row);
};

/**
 * The Excel file of an Analysis export: sheets Labels and Codes (one or both, as Display answers
 * says), then Datamap and Unmapped values. Built whole in memory, by nature of the format; set
 * `maxCells` to cap it.
 */
export const buildAnalysisWorkbook = async (
  exported: TAnalysisExport,
  { display, questions, maxCells, include }: TAnalysisWorkbookOptions
): Promise<Buffer> => {
  const workbook = createXlsxWorkbook();
  const parts = dataParts(display).map((part) => ({
    part,
    sheet: workbook.addSheet(part.sheet, dataHeaderCells(exported.columns, display, part.kind, questions)),
  }));

  const assertWithinLimit = (cells: number): void => {
    if (maxCells !== undefined && cells > maxCells) {
      throw new XlsxLimitError(`The workbook would hold ${cells} cells, more than the ${maxCells} allowed`);
    }
  };
  assertWithinLimit(
    analysisWorkbookCells({
      display,
      columns: exported.columns.length,
      responses: exported.counts.included,
    })
  );

  for await (const batch of exported.rows()) {
    for (const row of batch) {
      for (const { part, sheet } of parts) sheet.addRow(rowCells(row, part.kind));
    }
    assertWithinLimit(workbook.cellCount());
  }

  if (include?.datamap !== false) addDatamapSheet(workbook, exported);
  if (include?.unmappedValues !== false) addUnmappedSheet(workbook, exported);

  return workbook.toBuffer();
};

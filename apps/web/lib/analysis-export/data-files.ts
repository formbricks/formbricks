import type { TAnalysisColumn, TAnswerDisplay } from "./types";

export type TDataKind = "codes" | "labels";

/** One data table of an Analysis export: a sheet in the workbook, a CSV file in the zip. */
export type TDataPart = { kind: TDataKind; sheet: "Codes" | "Labels"; csvName: string };

/**
 * Which data tables "Display answers" asks for. "Text and code" is two files (`labels.csv` plus
 * `codes.csv`) and two sheets; the other two are a single `data.csv` and a single sheet.
 */
export const dataParts = (display: TAnswerDisplay): TDataPart[] => {
  if (display === "codes") return [{ kind: "codes", sheet: "Codes", csvName: "data.csv" }];
  if (display === "text") return [{ kind: "labels", sheet: "Labels", csvName: "data.csv" }];
  return [
    { kind: "labels", sheet: "Labels", csvName: "labels.csv" },
    { kind: "codes", sheet: "Codes", csvName: "codes.csv" },
  ];
};

/**
 * Header cells of a data table. With "Text and code" the labels table says what each question column
 * asks (`q2; Question text`), so a reader of that file does not need the Datamap open; the codes table
 * keeps the bare column names SPSS and other tools expect. Everywhere else the header is the name.
 */
export const dataHeaderCells = (
  columns: readonly TAnalysisColumn[],
  display: TAnswerDisplay,
  kind: TDataKind
): string[] =>
  columns.map((column) =>
    display === "both" && kind === "labels" && column.question
      ? `${column.name}; ${column.question.headline}`
      : column.name
  );

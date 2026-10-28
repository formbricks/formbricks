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

/** What a question column asks, as one line of text: the question, then the option or matrix row it stands for. */
export const columnQuestionText = (column: TAnalysisColumn): string => {
  if (!column.question) return column.name;
  const part = column.matrixRow ?? column.option;
  return part ? `${column.question.headline} – ${part.label}` : column.question.headline;
};

/**
 * Header cells of a data table. `questions` is the modal's "Display questions": Text only writes what the
 * column asks, Code only the bare column name SPSS and other tools expect, Text and code both in one cell
 * (`q2; Question text`). Only question columns have text; the response columns keep their names.
 *
 * Without `questions` the header follows "Display answers", as the first version of the route did: with
 * Text and code the labels table reads `q2; Question text` and the codes table keeps the plain names.
 */
export const dataHeaderCells = (
  columns: readonly TAnalysisColumn[],
  display: TAnswerDisplay,
  kind: TDataKind,
  questions?: TAnswerDisplay
): string[] =>
  columns.map((column) => {
    if (questions === undefined) {
      return display === "both" && kind === "labels" && column.question
        ? `${column.name}; ${column.question.headline}`
        : column.name;
    }
    if (!column.question || questions === "codes") return column.name;
    const text = columnQuestionText(column);
    return questions === "text" ? text : `${column.name}; ${text}`;
  });

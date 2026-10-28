import { V3_FEEDBACK_QUERY_DEFAULT_LIMIT } from "@/app/api/v3/feedback-queries/lib/schemas";
import type { TFeedbackChartColumn, TFeedbackChartSpec } from "./chart-spec";

/** Rows the text summary spells out for the model; the view and `structuredContent` carry all of them. */
export const FEEDBACK_CHART_TEXT_ROWS = 12;
const TEXT_CELL_MAX_LENGTH = 60;

export type TFeedbackChartCell = string | number | boolean | null;
export type TFeedbackChartRow = Record<string, TFeedbackChartCell>;

/** Keep only the columns the query asked for, so a stray key from the analytics service never leaks through. */
export const projectRows = (
  rows: Record<string, TFeedbackChartCell>[],
  columns: TFeedbackChartColumn[]
): TFeedbackChartRow[] =>
  rows.map((row) => Object.fromEntries(columns.map((column) => [column.id, row[column.id] ?? null])));

/**
 * Whether the rows reached the query's limit. The query has no paging, so a full page means there may be
 * more groups than were returned and the chart says so instead of presenting a cut-off result as complete.
 */
export const isTruncated = (rowCount: number, query: { limit?: unknown }): boolean => {
  const limit = typeof query.limit === "number" ? query.limit : V3_FEEDBACK_QUERY_DEFAULT_LIMIT;
  return rowCount >= limit;
};

const formatCell = (value: TFeedbackChartCell): string => {
  if (value === null) return "(none)";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  }
  // One line, bounded: a feedback value is free text and must not be able to break the table or flood it.
  const flat = String(value).replace(/\s+/g, " ").trim();
  if (flat.length === 0) return "(empty)";
  return flat.length > TEXT_CELL_MAX_LENGTH ? `${flat.slice(0, TEXT_CELL_MAX_LENGTH - 1)}…` : flat;
};

const escapeCell = (text: string): string => text.replaceAll("|", "\\|");

/** The top rows as a compact pipe table, so a model that cannot see the chart can still read it. */
export const buildTextTable = (
  columns: TFeedbackChartColumn[],
  rows: TFeedbackChartRow[],
  maxRows = FEEDBACK_CHART_TEXT_ROWS
): string => {
  if (rows.length === 0 || columns.length === 0) return "";
  const header = `| ${columns.map((column) => escapeCell(column.label)).join(" | ")} |`;
  const divider = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows
    .slice(0, maxRows)
    .map(
      (row) => `| ${columns.map((column) => escapeCell(formatCell(row[column.id] ?? null))).join(" | ")} |`
    );
  const more =
    rows.length > maxRows ? [`(${rows.length - maxRows} more rows in the chart's table view)`] : [];
  return [header, divider, ...body, ...more].join("\n");
};

/**
 * The model-facing text: what was drawn, how much data there is, and the top rows. It has to stand alone,
 * because a host without MCP Apps support shows only this and a model never sees the picture.
 */
export const buildChartSummary = ({
  spec,
  columns,
  rows,
  truncated,
  datasetName,
}: {
  spec: TFeedbackChartSpec;
  columns: TFeedbackChartColumn[];
  rows: TFeedbackChartRow[];
  truncated: boolean;
  datasetName: string;
}): string => {
  const lines: string[] = [];
  const drawn =
    spec.type === "table" ? "a table" : `a ${spec.type === "number" ? "number" : `${spec.type} chart`}`;
  lines.push(
    `${spec.title}: ${rows.length === 0 ? "the query returned no rows" : `${rows.length} ${rows.length === 1 ? "row" : "rows"}`} from the feedback dataset "${datasetName}", shown to the user as ${drawn}.`
  );
  if (truncated) {
    lines.push(
      "The result reached the row limit, so there may be more groups than shown. Narrow the query or raise its limit to be sure."
    );
  }
  if (spec.omittedMeasures && spec.omittedMeasures.length > 0) {
    lines.push(
      `Not plotted, but in the table: ${spec.omittedMeasures.join(", ")}. Charts draw one scale at a time.`
    );
  }
  const table = buildTextTable(columns, rows);
  if (table) lines.push(table);
  return lines.join("\n");
};

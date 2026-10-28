import { isRecord } from "../../shared/guards";
import { type ToolResult, getResultText } from "../../shared/tool-result";

/**
 * The shape `show_feedback_chart` puts in `structuredContent` (apps/web/modules/mcp/apps/feedback-chart),
 * read defensively: the view renders whatever a host hands it, so every field is checked rather than cast.
 */

export type CellValue = string | number | boolean | null;
export type ChartRow = Record<string, CellValue>;
export type ChartType = "bar" | "line" | "area" | "pie" | "number" | "table";
export type Granularity = "hour" | "day" | "week" | "month" | "quarter" | "year";

export interface ChartColumn {
  id: string;
  label: string;
  kind: "time" | "dimension" | "measure";
  domain?: [number, number];
}

export interface ChartSpec {
  type: ChartType;
  title: string;
  x?: string;
  xKind?: "time" | "category";
  granularity?: Granularity;
  y: string[];
  series?: string;
  omittedMeasures?: string[];
}

export interface FeedbackChartModel {
  spec: ChartSpec;
  columns: ChartColumn[];
  rows: ChartRow[];
  truncated: boolean;
  datasetId?: string;
  datasetName?: string;
  query?: Record<string, unknown>;
  requestId?: string;
}

const CHART_TYPES = ["bar", "line", "area", "pie", "number", "table"] as const satisfies readonly ChartType[];
const GRANULARITIES = [
  "hour",
  "day",
  "week",
  "month",
  "quarter",
  "year",
] as const satisfies readonly Granularity[];

const isChartType = (value: unknown): value is ChartType => CHART_TYPES.some((type) => type === value);

const isGranularity = (value: unknown): value is Granularity =>
  GRANULARITIES.some((granularity) => granularity === value);

const isCell = (value: unknown): value is CellValue =>
  value === null || ["string", "number", "boolean"].includes(typeof value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const readDomain = (value: unknown): [number, number] | undefined => {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const low: unknown = value[0];
  const high: unknown = value[1];
  return typeof low === "number" && Number.isFinite(low) && typeof high === "number" && Number.isFinite(high)
    ? [low, high]
    : undefined;
};

const readColumn = (value: unknown): ChartColumn | undefined => {
  if (!isRecord(value)) return undefined;
  const { id, label, kind, domain } = value;
  if (typeof id !== "string" || typeof label !== "string") return undefined;
  if (kind !== "time" && kind !== "dimension" && kind !== "measure") return undefined;
  const bounds = readDomain(domain);
  return { id, label, kind, ...(bounds ? { domain: bounds } : {}) };
};

const readSpec = (value: unknown): ChartSpec | undefined => {
  if (!isRecord(value)) return undefined;
  const { type, title, x, xKind, granularity, y, series, omittedMeasures } = value;
  if (!isChartType(type) || typeof title !== "string") return undefined;
  if (!isStringArray(y)) return undefined;
  return {
    type,
    title,
    y,
    ...(typeof x === "string" ? { x } : {}),
    ...(xKind === "time" || xKind === "category" ? { xKind } : {}),
    ...(isGranularity(granularity) ? { granularity } : {}),
    ...(typeof series === "string" ? { series } : {}),
    ...(isStringArray(omittedMeasures) && omittedMeasures.length > 0 ? { omittedMeasures } : {}),
  };
};

const readRows = (value: unknown): ChartRow[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const rows: ChartRow[] = [];
  for (const item of value) {
    if (!isRecord(item)) return undefined;
    const row: ChartRow = {};
    for (const [key, cell] of Object.entries(item)) {
      row[key] = isCell(cell) ? cell : null;
    }
    rows.push(row);
  }
  return rows;
};

/** The model a result describes, or `undefined` when it is not a chart result (the view then shows its text). */
export const parseFeedbackChart = (structured: unknown): FeedbackChartModel | undefined => {
  if (!isRecord(structured)) return undefined;
  const spec = readSpec(structured.chart);
  const rows = readRows(structured.rows);
  if (!spec || !rows || !Array.isArray(structured.columns)) return undefined;
  const columns = structured.columns.map(readColumn);
  if (columns.some((column) => column === undefined)) return undefined;
  return {
    spec,
    columns: columns.filter((column): column is ChartColumn => column !== undefined),
    rows,
    truncated: structured.truncated === true,
    ...(typeof structured.datasetId === "string" ? { datasetId: structured.datasetId } : {}),
    ...(typeof structured.datasetName === "string" ? { datasetName: structured.datasetName } : {}),
    ...(isRecord(structured.query) ? { query: structured.query } : {}),
    ...(typeof structured.requestId === "string" ? { requestId: structured.requestId } : {}),
  };
};

/**
 * What went wrong, as a sentence for the person. A failed Formbricks tool answers `{ error: { title,
 * detail, ... } }` in `structuredContent`; the shared `getToolError` only reads a top-level `detail`, so
 * this reads the nested one too and never shows the JSON text the server also puts in `content`.
 */
export const readChartError = (result: ToolResult | null | undefined): string | undefined => {
  if (!result) return undefined;
  const structured = result.structuredContent;
  const error = isRecord(structured) && isRecord(structured.error) ? structured.error : undefined;
  if (error && typeof error.detail === "string") return error.detail;
  if (result.isError) {
    if (isRecord(structured) && typeof structured.detail === "string") return structured.detail;
    const text = getResultText(result);
    return text && !text.trimStart().startsWith("{") ? text : "The query could not be run.";
  }
  return undefined;
};

/** The HTTP-ish status of a failed result, so the view can tell "not licensed" from "try again". */
export const readChartErrorStatus = (result: ToolResult | null | undefined): number | undefined => {
  const structured = result?.structuredContent;
  const error = isRecord(structured) && isRecord(structured.error) ? structured.error : undefined;
  return error && typeof error.status === "number" ? error.status : undefined;
};

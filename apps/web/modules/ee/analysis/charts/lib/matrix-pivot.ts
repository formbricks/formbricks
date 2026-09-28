import type { TChartConfig, TChartQuery } from "@formbricks/types/analysis";
import { isRatioMeasure } from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";

/**
 * The matrix chart: two groupings × one measure laid out as a grid. The headline use is a Likert
 * matrix question — statements down the side, scale points across the top, each cell the share of
 * that statement's answers — but any two groupings work ("country × source", "sentiment × device").
 *
 * Everything here is pure so the grid logic is tested without rendering; `matrix-chart.tsx` only
 * draws what {@link buildMatrixPivot} returns.
 */

export type TMatrixCellValue = NonNullable<TChartConfig["matrixCellValue"]>;

/** Past this the grid stops being readable; the chart asks the user to narrow the query instead. */
export const MATRIX_MAX_ROWS = 30;
export const MATRIX_MAX_COLUMNS = 15;

/** Number of tint steps the colour scale uses (0 = no tint). */
export const MATRIX_COLOR_STEPS = 6;

export interface TMatrixDisplay {
  cellValue: TMatrixCellValue;
  colorScale: boolean;
  showTotals: boolean;
  transpose: boolean;
}

/** Charts saved before these settings existed have an empty config; these are what they render with. */
export const resolveMatrixDisplay = (config: TChartConfig | null | undefined): TMatrixDisplay => ({
  cellValue: config?.matrixCellValue ?? "percent",
  colorScale: config?.matrixColorScale ?? true,
  showTotals: config?.matrixShowTotals ?? false,
  transpose: config?.matrixTranspose ?? false,
});

// ── Query shape ───────────────────────────────────────────────────────────────

export type TMatrixQueryIssue = "needs_one_measure" | "needs_two_groupings" | "no_time_grouping";

/**
 * What stops a query from being drawn as a matrix, in the order the builder asks the user to fix
 * them. Empty when the query is a valid matrix: exactly two groupings (rows, then columns), exactly
 * one measure, and no time bucketing — a time grouping would be a third axis the grid cannot show.
 */
export const getMatrixQueryIssues = (query: TChartQuery | null | undefined): TMatrixQueryIssue[] => {
  const issues: TMatrixQueryIssue[] = [];
  if ((query?.measures?.length ?? 0) !== 1) issues.push("needs_one_measure");
  if ((query?.dimensions?.length ?? 0) !== 2) issues.push("needs_two_groupings");
  if (query?.timeDimensions?.some((td) => Boolean(td.granularity))) issues.push("no_time_grouping");
  return issues;
};

// ── The recipe for a matrix question ──────────────────────────────────────────

export const MATRIX_ROW_DIMENSION_ID = "FeedbackRecords.fieldId";
export const MATRIX_COLUMN_DIMENSION_ID = "FeedbackRecords.valueId";
export const MATRIX_GROUP_FILTER_MEMBER = "FeedbackRecords.fieldGroupLabel";
export const MATRIX_DEFAULT_MEASURE_ID = "FeedbackRecords.count";

/**
 * The query that draws one matrix question as statements × scale points: every record of the
 * question (its field group), one row per statement (the stable field id), one column per scale
 * point (the stable column id), counted. The server resolves both ids back to the survey's labels
 * and order, so the chart reads exactly like the question. Any date range the builder already has
 * is kept — picking a question should not silently widen the chart to all time.
 */
export const buildMatrixQuestionQuery = (
  groupLabel: string,
  timeDimensions?: TChartQuery["timeDimensions"]
): TChartQuery => {
  const dateRangeOnly = timeDimensions
    ?.filter((td) => td.dateRange)
    .map(({ granularity: _granularity, ...td }) => td);
  return {
    measures: [MATRIX_DEFAULT_MEASURE_ID],
    dimensions: [MATRIX_ROW_DIMENSION_ID, MATRIX_COLUMN_DIMENSION_ID],
    filters: [{ member: MATRIX_GROUP_FILTER_MEMBER, operator: "equals", values: [groupLabel] }],
    ...(dateRangeOnly && dateRangeOnly.length > 0 ? { timeDimensions: dateRangeOnly } : {}),
  };
};

/**
 * The matrix question a query draws, when the query is the matrix recipe for one question (same
 * rows and columns, filtered to one field group) — so the picker can show what is selected. Null for
 * any other query, including a recipe the user has since edited into something else.
 */
export const getMatrixQuestionLabel = (query: TChartQuery | null | undefined): string | null => {
  const [rows, columns] = query?.dimensions ?? [];
  if (rows !== MATRIX_ROW_DIMENSION_ID || columns !== MATRIX_COLUMN_DIMENSION_ID) return null;
  const groupFilters = (query?.filters ?? []).filter(
    (filter) => "member" in filter && filter.member === MATRIX_GROUP_FILTER_MEMBER
  );
  if (groupFilters.length !== 1) return null;
  const [filter] = groupFilters;
  if (!("member" in filter) || filter.operator !== "equals" || filter.values?.length !== 1) return null;
  return filter.values[0];
};

// ── Pivot ─────────────────────────────────────────────────────────────────────

export interface TMatrixCell {
  /** The measure's value; 0 for a combination with no records. */
  value: number;
  /** Share of the cell's row total (0–1), or null where a share is meaningless. */
  share: number | null;
}

export interface TMatrixLine {
  key: string;
  label: string;
  /** Sum of the line's cells; null for a ratio measure, which cannot be added up. */
  total: number | null;
}

export interface TMatrixRow extends TMatrixLine {
  cells: TMatrixCell[];
  /** No records at all in this row: rendered as an en dash rather than a row of zeros. */
  isEmpty: boolean;
}

export interface TMatrixPivot {
  rows: TMatrixRow[];
  columns: TMatrixLine[];
  grandTotal: number | null;
  /** Whether cells can be summed and expressed as shares (counts can, averages and scores cannot). */
  isAdditive: boolean;
  /** Largest value the colour scale is measured against, per the cell value being shown. */
  maxValue: number;
  maxShare: number;
}

export interface TBuildMatrixPivotInput {
  data: TChartDataRow[];
  rowKey: string;
  columnKey: string;
  measureKey: string;
  /** Preferred row order, e.g. the survey's statements (keys of `fieldLabels`). Missing keys go last. */
  rowOrder?: string[];
  /** Preferred column order, e.g. the survey's scale (keys of `optionLabels`). Missing keys go last. */
  columnOrder?: string[];
  /**
   * Whether every key of `rowOrder` / `columnOrder` belongs in the grid even without data — true
   * when the server pinned the maps to the chart's question, so a scale point nobody picked shows
   * as 0% instead of disappearing.
   */
  includeUnansweredRows?: boolean;
  includeUnansweredColumns?: boolean;
  formatRowLabel: (value: string) => string;
  formatColumnLabel: (value: string) => string;
}

const toKey = (value: unknown): string | null => {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
};

const toNumber = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

/**
 * Order keys by a preferred order, then append the rest. Rest keys keep the order `fallback` gives.
 */
const orderKeys = (
  present: string[],
  preferred: string[] | undefined,
  includeAllPreferred: boolean,
  fallback: (a: string, b: string) => number
): string[] => {
  const presentSet = new Set(present);
  const fromPreferred = (preferred ?? []).filter((key) => includeAllPreferred || presentSet.has(key));
  const preferredSet = new Set(fromPreferred);
  const rest = present.filter((key) => !preferredSet.has(key)).sort(fallback);
  return [...fromPreferred, ...rest];
};

/**
 * Pivot a two-grouping query result into a grid.
 *
 * Columns follow `columnOrder` (the survey's scale order), falling back to alphabetical by label.
 * Rows follow `rowOrder` (the survey's statement order), falling back to the largest row first.
 * Cells with no records are 0, never blank. Shares are always of the row — the first grouping — so
 * for a matrix question each statement's cells add up to 100%, whichever way the grid is displayed.
 */
export const buildMatrixPivot = ({
  data,
  rowKey,
  columnKey,
  measureKey,
  rowOrder,
  columnOrder,
  includeUnansweredRows = false,
  includeUnansweredColumns = false,
  formatRowLabel,
  formatColumnLabel,
}: TBuildMatrixPivotInput): TMatrixPivot => {
  const isAdditive = !isRatioMeasure(measureKey);
  const values = new Map<string, Map<string, number>>();
  const rowTotals = new Map<string, number>();
  const columnKeys = new Set<string>();

  for (const record of data) {
    const r = toKey(record[rowKey]);
    const c = toKey(record[columnKey]);
    if (r === null || c === null) continue;
    const value = toNumber(record[measureKey]);
    const rowValues = values.get(r) ?? new Map<string, number>();
    // Two rows for the same pair only happen if Cube returns duplicates; add rather than overwrite
    // for a count, and keep the first reading for a ratio, which cannot be added.
    rowValues.set(c, isAdditive ? (rowValues.get(c) ?? 0) + value : (rowValues.get(c) ?? value));
    values.set(r, rowValues);
    rowTotals.set(r, (rowTotals.get(r) ?? 0) + value);
    columnKeys.add(c);
  }

  const orderedColumns = orderKeys([...columnKeys], columnOrder, includeUnansweredColumns, (a, b) =>
    formatColumnLabel(a).localeCompare(formatColumnLabel(b))
  );
  const orderedRows = orderKeys(
    [...values.keys()],
    rowOrder,
    includeUnansweredRows,
    (a, b) => (rowTotals.get(b) ?? 0) - (rowTotals.get(a) ?? 0)
  );

  let maxValue = 0;
  let maxShare = 0;
  const columnTotals = orderedColumns.map(() => 0);

  const rows: TMatrixRow[] = orderedRows.map((r) => {
    const rowValues = values.get(r);
    const total = rowTotals.get(r) ?? 0;
    const cells = orderedColumns.map((c, index): TMatrixCell => {
      const value = rowValues?.get(c) ?? 0;
      const share = isAdditive && total > 0 ? value / total : null;
      columnTotals[index] += value;
      maxValue = Math.max(maxValue, value);
      if (share !== null) maxShare = Math.max(maxShare, share);
      return { value, share };
    });
    return {
      key: r,
      label: formatRowLabel(r),
      cells,
      total: isAdditive ? total : null,
      isEmpty: !rowValues,
    };
  });

  const columns: TMatrixLine[] = orderedColumns.map((c, index) => ({
    key: c,
    label: formatColumnLabel(c),
    total: isAdditive ? columnTotals[index] : null,
  }));

  return {
    rows,
    columns,
    grandTotal: isAdditive ? columnTotals.reduce((sum, v) => sum + v, 0) : null,
    isAdditive,
    maxValue,
    maxShare,
  };
};

// ── Display helpers ───────────────────────────────────────────────────────────

/** A cell as shown on screen: its row and column labels and values, after an optional transpose. */
export interface TMatrixGridCell extends TMatrixCell {
  rowLabel: string;
  columnLabel: string;
  /** The total of the pivot row the share is taken from — the statement's answer count. */
  shareBase: number | null;
  isEmptyRow: boolean;
}

export interface TMatrixGrid {
  rowHeaders: TMatrixLine[];
  columnHeaders: TMatrixLine[];
  cells: TMatrixGridCell[][];
  grandTotal: number | null;
}

/**
 * The grid to draw. Transposing only swaps what is on screen: shares stay shares of the original
 * row, so a matrix question's statements still add up to 100% when they run across the top.
 */
export const toMatrixGrid = (pivot: TMatrixPivot, transpose: boolean): TMatrixGrid => {
  const cellAt = (rowIndex: number, columnIndex: number): TMatrixGridCell => {
    const row = pivot.rows[rowIndex];
    const column = pivot.columns[columnIndex];
    return {
      ...row.cells[columnIndex],
      rowLabel: row.label,
      columnLabel: column.label,
      shareBase: row.total,
      isEmptyRow: row.isEmpty,
    };
  };

  if (!transpose) {
    return {
      rowHeaders: pivot.rows,
      columnHeaders: pivot.columns,
      cells: pivot.rows.map((_, r) => pivot.columns.map((_, c) => cellAt(r, c))),
      grandTotal: pivot.grandTotal,
    };
  }
  return {
    rowHeaders: pivot.columns,
    columnHeaders: pivot.rows,
    cells: pivot.columns.map((_, c) => pivot.rows.map((_, r) => cellAt(r, c))),
    grandTotal: pivot.grandTotal,
  };
};

/**
 * What a cell prints. A ratio measure has no share, so it always prints its value. `formatValue`
 * and `formatShare` carry the locale, which this module does not know.
 */
export const formatMatrixCell = (
  cell: TMatrixCell,
  cellValue: TMatrixCellValue,
  formatValue: (value: number) => string,
  formatShare: (share: number) => string
): string => {
  if (cell.share === null) return formatValue(cell.value);
  if (cellValue === "count") return formatValue(cell.value);
  if (cellValue === "both") return `${formatShare(cell.share)} (${formatValue(cell.value)})`;
  return formatShare(cell.share);
};

/**
 * Tint step (0 … MATRIX_COLOR_STEPS - 1) for a cell, measured against the largest cell of the grid.
 * Shares are measured against the largest share and counts against the largest count, so the scale
 * always tracks the number the user is reading. Zero is always step 0 (untinted).
 */
export const getMatrixColorStep = (
  cell: TMatrixCell,
  pivot: Pick<TMatrixPivot, "maxValue" | "maxShare">,
  cellValue: TMatrixCellValue
): number => {
  const useShare = cell.share !== null && cellValue !== "count";
  const value = useShare ? (cell.share ?? 0) : cell.value;
  const max = useShare ? pivot.maxShare : pivot.maxValue;
  if (value <= 0 || max <= 0) return 0;
  const step = Math.ceil((value / max) * (MATRIX_COLOR_STEPS - 1));
  return Math.min(MATRIX_COLOR_STEPS - 1, Math.max(1, step));
};

/** Whether a grid is too large to read, in which case the chart asks for a narrower query. */
export const isMatrixTooLarge = (pivot: Pick<TMatrixPivot, "rows" | "columns">): boolean =>
  pivot.rows.length > MATRIX_MAX_ROWS || pivot.columns.length > MATRIX_MAX_COLUMNS;

"use client";

import { CheckCircle2Icon, CircleIcon, Grid3x3Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TChartConfig, TChartQuery } from "@formbricks/types/analysis";
import { cn } from "@/lib/cn";
import { formatCellValue } from "@/modules/ee/analysis/charts/lib/chart-utils";
import {
  MATRIX_COLUMN_DIMENSION_ID,
  MATRIX_MAX_COLUMNS,
  MATRIX_MAX_ROWS,
  MATRIX_ROW_DIMENSION_ID,
  type TMatrixGridCell,
  type TMatrixQueryIssue,
  buildMatrixPivot,
  formatMatrixCell,
  getMatrixColorStep,
  getMatrixQueryIssues,
  isMatrixTooLarge,
  resolveMatrixDisplay,
  toMatrixGrid,
} from "@/modules/ee/analysis/charts/lib/matrix-pivot";
import {
  formatCubeColumnHeader,
  getTranslatedDimensionValueLabel,
  getTranslatedFieldLabel,
} from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow, TChartLabelMaps } from "@/modules/ee/analysis/types/analysis";

/** Shown instead of a number when a row has no answers at all (an en dash, not a zero). */
const NO_DATA_PLACEHOLDER = "–";

/**
 * Background per colour step: the brand teal at rising opacity. Text stays slate-900 on every step —
 * the darkest step is the plain brand teal, which dark text reads on at better than 7:1, where white
 * text would not reach 3:1.
 */
const COLOR_STEP_ALPHA = [0, 0.1, 0.22, 0.38, 0.58, 0.82];
const cellBackground = (step: number): string | undefined =>
  step === 0 ? undefined : `rgba(0, 196, 184, ${COLOR_STEP_ALPHA[step]})`;

interface MatrixChartProps extends TChartLabelMaps {
  data: TChartDataRow[];
  query: TChartQuery;
  config?: TChartConfig;
}

/** The checklist shown while the query is not yet a matrix — what to change, not just that it's wrong. */
function MatrixSetupChecklist({ issues }: Readonly<{ issues: TMatrixQueryIssue[] }>) {
  const { t } = useTranslation();
  const steps: { issue: TMatrixQueryIssue; label: string }[] = [
    { issue: "needs_one_measure", label: t("workspace.analysis.charts.matrix_setup_one_measure") },
    { issue: "needs_two_groupings", label: t("workspace.analysis.charts.matrix_setup_two_groupings") },
    { issue: "no_time_grouping", label: t("workspace.analysis.charts.matrix_setup_no_time_grouping") },
  ];

  return (
    <div className="flex h-full min-h-48 items-center justify-center p-4">
      <div className="max-w-sm space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <Grid3x3Icon className="size-4 text-slate-500" />
          {t("workspace.analysis.charts.matrix_setup_title")}
        </div>
        <p className="text-sm text-slate-500">{t("workspace.analysis.charts.matrix_setup_description")}</p>
        <ul className="space-y-2">
          {steps.map(({ issue, label }) => {
            const done = !issues.includes(issue);
            return (
              <li key={issue} className="flex items-start gap-2 text-sm">
                {done ? (
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-brand-dark" aria-hidden="true" />
                ) : (
                  <CircleIcon className="mt-0.5 size-4 shrink-0 text-slate-300" aria-hidden="true" />
                )}
                <span className={done ? "text-slate-500" : "text-slate-900"}>
                  <span className="sr-only">
                    {done
                      ? t("workspace.analysis.charts.matrix_setup_step_done")
                      : t("workspace.analysis.charts.matrix_setup_step_todo")}
                  </span>
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/**
 * Two groupings × one measure as a grid — the chart a Likert matrix question is read in: statements
 * down the side, scale points across the top, each cell the share of that statement's answers.
 * Rows and columns come out in survey order when the server resolved the matrix's labels, and any
 * other two groupings render the same way ("country × source").
 */
export function MatrixChart({ data, query, config, optionLabels, fieldLabels }: Readonly<MatrixChartProps>) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";

  const issues = getMatrixQueryIssues(query);
  if (issues.length > 0) return <MatrixSetupChecklist issues={issues} />;

  const [rowKey, columnKey] = query.dimensions as [string, string];
  const measureKey = (query.measures as string[])[0];
  const display = resolveMatrixDisplay(config);

  // Survey text and order for the two id dimensions the matrix recipe groups by; every other
  // dimension labels itself the way the other charts label it.
  const labelMapFor = (dimension: string): Record<string, string> | undefined => {
    if (dimension === MATRIX_ROW_DIMENSION_ID) return fieldLabels;
    if (dimension === MATRIX_COLUMN_DIMENSION_ID) return optionLabels;
    return undefined;
  };
  const formatterFor = (dimension: string) => {
    const labels = labelMapFor(dimension);
    return (value: string): string =>
      labels?.[value] ?? getTranslatedDimensionValueLabel(dimension, value, t) ?? formatCellValue(value);
  };
  const rowLabels = labelMapFor(rowKey);
  const columnLabels = labelMapFor(columnKey);

  const pivot = buildMatrixPivot({
    data,
    rowKey,
    columnKey,
    measureKey,
    rowOrder: rowLabels ? Object.keys(rowLabels) : undefined,
    columnOrder: columnLabels ? Object.keys(columnLabels) : undefined,
    // The server only ships a whole map when the filters named the question, so every key in it is
    // a statement or scale point of this chart — including ones nobody picked yet.
    includeUnansweredRows: Boolean(rowLabels),
    includeUnansweredColumns: Boolean(columnLabels),
    formatRowLabel: formatterFor(rowKey),
    formatColumnLabel: formatterFor(columnKey),
  });

  if (pivot.rows.length === 0 || pivot.columns.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full min-h-48 items-center justify-center">
        {t("workspace.analysis.charts.no_data_available")}
      </div>
    );
  }

  if (isMatrixTooLarge(pivot)) {
    return (
      <div className="flex h-full min-h-48 items-center justify-center px-6 text-center text-sm text-slate-500">
        {t("workspace.analysis.charts.matrix_too_large", {
          rows: pivot.rows.length,
          columns: pivot.columns.length,
          maxRows: MATRIX_MAX_ROWS,
          maxColumns: MATRIX_MAX_COLUMNS,
        })}
      </div>
    );
  }

  const grid = toMatrixGrid(pivot, display.transpose);
  const showTotals = display.showTotals && pivot.isAdditive;
  const formatValue = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 2 });
  const formatShare = (share: number) =>
    new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(share);

  const cellTitle = (cell: TMatrixGridCell): string => {
    const base = `${cell.rowLabel} · ${cell.columnLabel}`;
    if (cell.share === null || cell.shareBase === null) return `${base}: ${formatValue(cell.value)}`;
    return t("workspace.analysis.charts.matrix_cell_tooltip", {
      cell: base,
      share: formatShare(cell.share),
      value: formatValue(cell.value),
      total: formatValue(cell.shareBase),
    });
  };

  // The corner names what the rows are. The matrix recipe's id dimensions read as "Field ID" and
  // "Value (Option)" in the builder, which says nothing to someone reading a Likert grid — once the
  // server resolved them to survey text, call them what they are.
  const describeDimension = (dimension: string): string => {
    if (dimension === MATRIX_ROW_DIMENSION_ID && fieldLabels)
      return t("workspace.analysis.charts.matrix_statement");
    if (dimension === MATRIX_COLUMN_DIMENSION_ID && optionLabels)
      return t("workspace.analysis.charts.matrix_answer");
    return getTranslatedFieldLabel(dimension, t);
  };
  const rowDimensionLabel = describeDimension(display.transpose ? columnKey : rowKey);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-2">
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            {t("workspace.analysis.charts.matrix_caption", {
              measure: formatCubeColumnHeader(measureKey, t),
            })}
          </caption>
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 max-w-56 min-w-32 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-500">
                {rowDimensionLabel}
              </th>
              {grid.columnHeaders.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  title={column.label}
                  className="min-w-20 border-b border-slate-200 px-2 py-2 text-center text-xs font-medium text-slate-700">
                  <span className="line-clamp-2">{column.label}</span>
                </th>
              ))}
              {showTotals && (
                <th
                  scope="col"
                  className="min-w-16 border-b border-l border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-700">
                  {t("workspace.analysis.charts.matrix_total")}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {grid.rowHeaders.map((row, rowIndex) => (
              <tr key={row.key} className="border-b border-slate-100 last:border-b-0">
                <th
                  scope="row"
                  title={row.label}
                  className="sticky left-0 z-10 max-w-56 min-w-32 bg-white px-3 py-2 text-left text-xs font-normal text-slate-700">
                  <span className="line-clamp-2">{row.label}</span>
                </th>
                {grid.cells[rowIndex].map((cell, columnIndex) => {
                  const step = display.colorScale ? getMatrixColorStep(cell, pivot, display.cellValue) : 0;
                  const text = cell.isEmptyRow
                    ? NO_DATA_PLACEHOLDER
                    : formatMatrixCell(cell, display.cellValue, formatValue, formatShare);
                  return (
                    <td
                      key={grid.columnHeaders[columnIndex].key}
                      title={cell.isEmptyRow ? undefined : cellTitle(cell)}
                      className={cn(
                        "px-2 py-2 text-center whitespace-nowrap tabular-nums",
                        cell.isEmptyRow ? "text-slate-400" : "text-slate-900"
                      )}
                      style={{ backgroundColor: cellBackground(step) }}>
                      {text}
                    </td>
                  );
                })}
                {showTotals && (
                  <td className="border-l border-slate-200 px-2 py-2 text-center font-medium whitespace-nowrap text-slate-900 tabular-nums">
                    {row.total === null ? NO_DATA_PLACEHOLDER : formatValue(row.total)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {showTotals && (
            <tfoot className="sticky bottom-0 bg-slate-50">
              <tr>
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-t border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">
                  {t("workspace.analysis.charts.matrix_total")}
                </th>
                {grid.columnHeaders.map((column) => (
                  <td
                    key={column.key}
                    className="border-t border-slate-200 px-2 py-2 text-center font-medium whitespace-nowrap text-slate-900 tabular-nums">
                    {column.total === null ? NO_DATA_PLACEHOLDER : formatValue(column.total)}
                  </td>
                ))}
                <td className="border-t border-l border-slate-200 px-2 py-2 text-center font-semibold whitespace-nowrap text-slate-900 tabular-nums">
                  {grid.grandTotal === null ? NO_DATA_PLACEHOLDER : formatValue(grid.grandTotal)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

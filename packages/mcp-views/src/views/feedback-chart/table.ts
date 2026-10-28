import { type FormatContext, formatFull, formatTimeFull, humanizeValue, parseTimestamp } from "./format";
import type { CellValue, ChartColumn, ChartSpec } from "./model";

/** A cell of the table view: the text shown and whether it is a number (right-aligned) or missing. */
export interface TableCell {
  text: string;
  numeric: boolean;
  missing: boolean;
}

/**
 * Every value of a column the way the chart names it: time buckets in long form, enum tokens in sentence
 * case, numbers with their full precision. A missing measure is "No data", never a zero.
 */
export const formatTableCell = (
  column: ChartColumn,
  value: CellValue,
  spec: Pick<ChartSpec, "granularity">,
  context: FormatContext
): TableCell => {
  if (column.kind === "measure") {
    return typeof value === "number"
      ? { text: formatFull(value, context.locale), numeric: true, missing: false }
      : { text: "No data", numeric: true, missing: true };
  }
  if (column.kind === "time" && spec.granularity) {
    const point = parseTimestamp(value);
    if (point)
      return { text: formatTimeFull(point, spec.granularity, context), numeric: false, missing: false };
  }
  return { text: humanizeValue(column.id, value, context.locale), numeric: false, missing: false };
};

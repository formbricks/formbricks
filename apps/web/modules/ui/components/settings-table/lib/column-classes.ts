import { cn } from "@/lib/cn";
import type {
  TSettingsTableAlign,
  TSettingsTableBreakpoint,
  TSettingsTableColumn,
  TSettingsTableFrame,
} from "../types";

const ALIGN_CLASSES: Record<TSettingsTableAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/**
 * `table-cell` rather than `block`: restoring a `<td>`/`<th>` to `display: block` would drop it out of
 * the table's column layout and misalign the whole row.
 */
const HIDE_BELOW_CLASSES: Record<TSettingsTableBreakpoint, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

/**
 * `overflow-hidden` has to sit on the same element as the radius, so row backgrounds are clipped by the
 * corner instead of squaring it off.
 */
const FRAME_CLASSES: Record<TSettingsTableFrame, string> = {
  none: "",
  card: "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs",
};

export const getFrameClassName = (frame: TSettingsTableFrame): string => FRAME_CLASSES[frame];

/** Width lives on the header cell only — the browser applies it to the whole column. */
export const getHeaderCellClassName = <TRow>(column: TSettingsTableColumn<TRow>): string =>
  cn(
    column.width,
    column.align ? ALIGN_CLASSES[column.align] : undefined,
    column.hideBelow ? HIDE_BELOW_CLASSES[column.hideBelow] : undefined
  );

export const getBodyCellClassName = <TRow>(column: TSettingsTableColumn<TRow>): string =>
  cn(
    column.align ? ALIGN_CLASSES[column.align] : undefined,
    column.hideBelow ? HIDE_BELOW_CLASSES[column.hideBelow] : undefined,
    column.cellClassName
  );

/**
 * The row is activated by a real `<button>` wrapping one column's content, not by `role="button"` on
 * the `<tr>` — a `row` cannot also be a `button`, and overriding the role drops the row out of the
 * table's accessibility tree. The button carries no click handler of its own: a click on it (including
 * the synthetic click a keyboard Enter/Space produces) bubbles to the row's own handler.
 */
export const getRowActivatorColumnId = <TRow>(columns: TSettingsTableColumn<TRow>[]): string | undefined =>
  columns.find((column) => !column.stopRowClick)?.id;

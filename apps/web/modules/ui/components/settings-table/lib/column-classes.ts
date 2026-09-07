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

/**
 * The header's type is set here rather than on the shared `TableHead`, because a class on the `th` beats
 * the `text-slate-800` a `<thead>` passes down: putting it in the primitive would lighten every bare
 * `TableHead` in the app, including the data tables for contacts, attributes and survey responses.
 *
 * `headerClassName` is merged last, so a column can override the alignment it just asked for.
 */
export const getHeaderCellClassName = <TRow>(column: TSettingsTableColumn<TRow>): string =>
  cn(
    "font-medium text-slate-500",
    column.align ? ALIGN_CLASSES[column.align] : undefined,
    column.hideBelow ? HIDE_BELOW_CLASSES[column.hideBelow] : undefined,
    column.headerClassName
  );

export const getBodyCellClassName = <TRow>(column: TSettingsTableColumn<TRow>): string =>
  cn(
    column.align ? ALIGN_CLASSES[column.align] : undefined,
    column.hideBelow ? HIDE_BELOW_CLASSES[column.hideBelow] : undefined,
    column.cellClassName
  );

/**
 * Whether a row should carry a click handler and an activator button.
 *
 * A disabled row must answer `false`. Dimming it with `pointer-events-none` only stops the mouse: the
 * activator `<button>` stays in the tab order, and Enter or Space on it fires a click that bubbles to
 * the row's handler — so a "disabled" row would still be operable from the keyboard.
 */
export const isRowActivatable = ({
  isDisabled,
  hasRowClick,
  isRowClickable = true,
}: Readonly<{ isDisabled: boolean; hasRowClick: boolean; isRowClickable?: boolean }>): boolean =>
  !isDisabled && hasRowClick && isRowClickable;

/**
 * The row is activated by a real `<button>` wrapping one column's content, not by `role="button"` on
 * the `<tr>` — a `row` cannot also be a `button`, and overriding the role drops the row out of the
 * table's accessibility tree. The button carries no click handler of its own: a click on it (including
 * the synthetic click a keyboard Enter/Space produces) bubbles to the row's own handler.
 */
export const getRowActivatorColumnId = <TRow>(columns: TSettingsTableColumn<TRow>[]): string | undefined =>
  columns.find((column) => !column.stopRowClick)?.id;

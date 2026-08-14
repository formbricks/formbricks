import type { ReactNode } from "react";

export type TSettingsTableAlign = "left" | "center" | "right";
export type TSettingsTableBreakpoint = "sm" | "md" | "lg";

/**
 * `none` — the table draws no frame, because a `<SettingsCard bodyVariant="flush">` already frames it.
 * `card` — the table draws its own frame, for use outside a settings card.
 */
export type TSettingsTableFrame = "none" | "card";

export type TSettingsTableColumn<TRow> = {
  /** Stable identifier, used as the React key for this column's header and every one of its cells. */
  id: string;
  /** Already-translated header label. `null` renders an empty header cell — pair it with `srLabel`. */
  header: ReactNode;
  cell: (row: TRow, index: number) => ReactNode;
  /**
   * Sets `text-align` on the header cell and every body cell in this column. Defaults to `left`.
   *
   * It moves **inline** content only. A cell holding block-level content — buttons, a link, a badge —
   * is unaffected, and needs a flex `cellClassName` (`flex justify-end`) to move instead. Don't declare
   * both for one column: the flex wins, and the `align` sitting next to it reads as load-bearing while
   * being inert. The skeleton draws its bar through the same two class sources, so whichever mechanism
   * aligns the real cell is also the one aligning the skeleton.
   */
  align?: TSettingsTableAlign;
  /** Hides the column below this breakpoint. Applied to the header and body cells together. */
  hideBelow?: TSettingsTableBreakpoint;
  /**
   * Extra classes merged onto the `<th>`.
   *
   * This is where a column's **width** belongs (`w-[22%]`, `w-16`), because the header cell is what
   * sizes the whole column — putting a width on `cellClassName` only affects that one cell. Widths are
   * suggestions rather than commands: the table is `table-auto`, so a long value can still borrow space
   * from a short one, and when a `hideBelow` column drops out the remaining widths rescale.
   */
  headerClassName?: string;
  /** Extra classes merged onto every `<td>` in this column, e.g. `font-medium text-slate-900`. */
  cellClassName?: string;
  /** Accessible name for a header cell whose `header` is `null` — typically an actions column. */
  srLabel?: string;
  /** Clicks inside this column do not activate the row. Use for action buttons and nested links. */
  stopRowClick?: boolean;
  /** Width of this column's skeleton bar. Defaults to `w-24`. */
  skeletonWidth?: `w-${string}`;
};

type SettingsTableBaseProps<TRow> = {
  columns: TSettingsTableColumn<TRow>[];
  rows: TRow[];
  getRowId: (row: TRow) => string;
  /** Already-translated. Rendered in a full-width cell when there are no rows. */
  emptyMessage: string;
  frame?: TSettingsTableFrame;
  isLoading?: boolean;
  skeletonRows?: number;
  /** Dims the row and blocks its interactions, e.g. while a sibling row's action is in flight. */
  isRowDisabled?: (row: TRow) => boolean;
  /** Non-row content rendered inside the frame, below the table — and outside its horizontal scroll. */
  footer?: ReactNode;
  /** Per-row DOM hooks. Prefer `data-testid` over `id`, which is not unique across rows. */
  getRowProps?: (row: TRow) => { id?: string; "data-testid"?: string };
  bodyProps?: { id?: string };
  id?: string;
  "aria-label"?: string;
  "data-testid"?: string;
  /** Classes for the `<table>` itself. */
  className?: string;
  /** Extra classes for the frame wrapper, e.g. a width constraint. Merged after `frame`. */
  containerClassName?: string;
};

/**
 * `getRowLabel` is required alongside `onRowClick`: the row's activator is a real `<button>`, and a
 * button built out of arbitrary cell content needs an accessible name.
 */
type SettingsTableClickProps<TRow> =
  | { onRowClick?: never; getRowLabel?: never; isRowClickable?: never }
  | {
      onRowClick: (row: TRow) => void;
      getRowLabel: (row: TRow) => string;
      isRowClickable?: (row: TRow) => boolean;
    };

export type TSettingsTableProps<TRow> = SettingsTableBaseProps<TRow> & SettingsTableClickProps<TRow>;

export type TSettingsTableSkeletonProps<TRow> = Pick<
  SettingsTableBaseProps<TRow>,
  "columns" | "frame" | "className" | "containerClassName"
> & { rows?: number };

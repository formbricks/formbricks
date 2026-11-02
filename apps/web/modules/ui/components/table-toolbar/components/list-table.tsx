"use client";

import { type Row, type Table as TTable, flexRender } from "@tanstack/react-table";
import { type CSSProperties, Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import { Skeleton } from "@/modules/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { TableNoMatch } from "./table-no-match";

const SKELETON_ROWS = 6;
/** Columns that hold a control (checkbox, row menu) rather than text: tight padding, never clipped. */
const CONTROL_COLUMNS = new Set(["select", "actions"]);

/**
 * The table body every toolbar table shares: one header row, hairline rows, a skeleton while the first
 * page loads, the no-match state, and Load more. Rows stay plain `<tr>`s so a row action (a menu, a
 * checkbox) is never nested inside a link.
 */
export const ListTable = <TData,>({
  table,
  isLoading,
  hasFilters,
  onClearFilters,
  onRowClick,
  isRowClickable,
  renderRowAddon,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  isExpanded,
  emptyContent,
  testId,
  minWidth,
  pinnedColumnIds = [],
}: Readonly<{
  table: TTable<TData>;
  isLoading: boolean;
  hasFilters: boolean;
  onClearFilters: () => void;
  onRowClick?: (row: Row<TData>) => void;
  isRowClickable?: (row: Row<TData>) => boolean;
  /** Content under a row, spanning every column (e.g. a notice with its own action). */
  renderRowAddon?: (row: Row<TData>) => ReactNode;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  isExpanded?: boolean;
  /** Shown instead of the no-match state when nothing is filtered and the table is empty. */
  emptyContent?: ReactNode;
  testId?: string;
  /** For wide tables: below this width the card scrolls sideways instead of squeezing every column. */
  minWidth?: number;
  /**
   * Leading columns that stay put while a wide table scrolls sideways (Responses keeps its checkbox and
   * date). Pinning switches the table to pixel widths, so each pinned column's offset is exact.
   */
  pinnedColumnIds?: readonly string[];
}>) => {
  const { t } = useTranslation();
  const visibleColumns = table.getVisibleLeafColumns();
  const columnCount = visibleColumns.length;
  const rows = table.getRowModel().rows;
  // Column sizes are proportions, not pixels: the table always fills its card and never scrolls
  // sideways because the visible columns happen to add up to more than the screen is wide.
  const totalSize = visibleColumns.reduce((sum, column) => sum + column.getSize(), 0) || 1;
  const isPinned = pinnedColumnIds.length > 0;
  const canResize = Boolean(table.options.enableColumnResizing);
  // Once a column has been dragged to a width, every width is that many pixels: proportions would
  // hand the change to every other column instead. The table may then scroll sideways.
  const isResized = Object.keys(table.getState().columnSizing ?? {}).length > 0;
  const usesPixels = isPinned || isResized;
  const widthOf = (size: number) => (usesPixels ? `${size}px` : `${((size / totalSize) * 100).toFixed(3)}%`);

  // Each pinned column sticks at the summed width of the pinned columns before it.
  const pinOffsets = new Map<string, number>();
  let pinnedWidth = 0;
  for (const column of visibleColumns) {
    if (!pinnedColumnIds.includes(column.id)) continue;
    pinOffsets.set(column.id, pinnedWidth);
    pinnedWidth += column.getSize();
  }
  const lastPinnedId = [...pinOffsets.keys()].at(-1);
  const pinStyle = (columnId: string, size: number): CSSProperties => {
    const offset = pinOffsets.get(columnId);
    return offset === undefined
      ? { width: widthOf(size) }
      : { width: widthOf(size), left: offset, position: "sticky", zIndex: 1 };
  };
  const pinClass = (columnId: string, isHeader = false) =>
    pinOffsets.has(columnId) &&
    cn(
      "bg-white",
      !isHeader && "group-hover:bg-slate-50 group-data-[state=selected]:bg-slate-50",
      columnId === lastPinnedId && "border-r border-slate-200"
    );
  const tableStyle = (): CSSProperties | undefined => {
    if (usesPixels) return { width: totalSize, minWidth: "100%" };
    return minWidth ? { minWidth } : undefined;
  };
  const emptyState = () => {
    if (!hasFilters && emptyContent) return emptyContent;
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-2">
        <p className="text-sm text-slate-500">
          {hasFilters ? t("common.table_toolbar.no_rows_match") : t("common.no_results")}
        </p>
        {hasFilters && (
          <Button size="sm" variant="secondary" onClick={onClearFilters}>
            {t("common.clear_filters")}
          </Button>
        )}
      </div>
    );
  };

  const renderBody = () => {
    if (isLoading) {
      return Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <TableRow key={`skeleton-${index}`} className="hover:bg-white">
          {table.getVisibleLeafColumns().map((column) => (
            <TableCell key={column.id} className="px-4 py-3">
              <Skeleton className="h-4 w-full max-w-32 rounded" />
            </TableCell>
          ))}
        </TableRow>
      ));
    }
    if (rows.length === 0) {
      // A wide, scrolling table shows its empty state under the table, where it is in view.
      if (isPinned) return null;
      if (!hasFilters && emptyContent) {
        return (
          <tr>
            <td colSpan={columnCount}>{emptyContent}</td>
          </tr>
        );
      }
      return <TableNoMatch colSpan={columnCount} hasFilters={hasFilters} onClearFilters={onClearFilters} />;
    }
    return rows.map((row) => {
      const clickable = Boolean(onRowClick) && (isRowClickable?.(row) ?? true);
      const addon = renderRowAddon?.(row);
      const isFromControl = (target: HTMLElement, row: HTMLElement) =>
        // A dialog or menu opened from the row renders in a portal: its events still bubble here
        // through React, but they are not the row's.
        !row.contains(target) ||
        // An event on a control inside the row (menu, checkbox, link) is that control's.
        Boolean(target.closest("button, a, input, [role='menuitem'], [role='checkbox']"));
      return (
        <Fragment key={row.id}>
          <TableRow
            data-state={row.getIsSelected() ? "selected" : undefined}
            className={cn(
              "group",
              clickable &&
                "cursor-pointer outline-none hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-inset"
            )}
            // Reachable and openable from the keyboard, like the link a row stands in for.
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={(event) => {
              if (!clickable || (event.key !== "Enter" && event.key !== " ")) return;
              if (event.target !== event.currentTarget) return;
              event.preventDefault();
              onRowClick?.(row);
            }}
            onClick={(event) => {
              if (!clickable || isFromControl(event.target as HTMLElement, event.currentTarget)) return;
              onRowClick?.(row);
            }}>
            {row.getVisibleCells().map((cell) => (
              <TableCell
                key={cell.id}
                style={pinStyle(cell.column.id, cell.column.getSize())}
                className={cn(
                  "text-sm text-slate-700",
                  pinClass(cell.column.id),
                  CONTROL_COLUMNS.has(cell.column.id) ? "px-2" : "px-4",
                  isExpanded ? "py-4" : "py-2.5"
                )}>
                <div
                  className={cn(
                    "flex min-w-0 items-center",
                    // Ellipsis has to sit on the text itself: a flex wrapper clips its child without one.
                    !isExpanded && !CONTROL_COLUMNS.has(cell.column.id) && "*:min-w-0 *:truncate"
                  )}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              </TableCell>
            ))}
          </TableRow>
          {addon && (
            <tr>
              <td colSpan={columnCount} className="p-0">
                {addon}
              </td>
            </tr>
          )}
        </Fragment>
      );
    });
  };

  return (
    <div className="space-y-4" data-testid={testId}>
      <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <Table className="w-full table-fixed" style={tableStyle()}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-white">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={pinStyle(header.column.id, header.getSize())}
                    className={cn(
                      "group/head relative h-10 text-xs font-medium whitespace-nowrap text-slate-600",
                      pinClass(header.column.id, true),
                      CONTROL_COLUMNS.has(header.column.id) ? "px-2" : "px-4"
                    )}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {canResize && header.column.getCanResize() && !CONTROL_COLUMNS.has(header.column.id) && (
                      // Drag to resize; double-click puts the column back to its default width. A pointer
                      // affordance only, kept out of the header's accessible name.
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-hidden="true"
                        data-testid="column-resize-handle"
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onDoubleClick={() => header.column.resetSize()}
                        className={cn(
                          "absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none",
                          "after:absolute after:inset-y-2 after:right-0 after:w-px after:bg-slate-200 after:opacity-0 group-hover/head:after:opacity-100",
                          header.column.getIsResizing() && "after:bg-slate-500 after:opacity-100"
                        )}
                      />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="[&_tr:last-child]:border-0">{renderBody()}</TableBody>
        </Table>
        {isPinned && !isLoading && rows.length === 0 && (
          <div className="sticky left-0 border-t border-slate-200">{emptyState()}</div>
        )}
      </div>
      {hasNextPage && onLoadMore && !isLoading && (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" onClick={onLoadMore} loading={isFetchingNextPage}>
            {t("common.load_more")}
          </Button>
        </div>
      )}
    </div>
  );
};

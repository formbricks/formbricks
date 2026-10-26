"use client";

import { type Row, type Table as TTable, flexRender } from "@tanstack/react-table";
import { Fragment, type ReactNode } from "react";
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
}>) => {
  const { t } = useTranslation();
  const visibleColumns = table.getVisibleLeafColumns();
  const columnCount = visibleColumns.length;
  const rows = table.getRowModel().rows;
  // Column sizes are proportions, not pixels: the table always fills its card and never scrolls
  // sideways because the visible columns happen to add up to more than the screen is wide.
  const totalSize = visibleColumns.reduce((sum, column) => sum + column.getSize(), 0) || 1;
  const widthOf = (size: number) => `${((size / totalSize) * 100).toFixed(3)}%`;

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
      return (
        <Fragment key={row.id}>
          <TableRow
            data-state={row.getIsSelected() ? "selected" : undefined}
            className={cn("group", clickable && "cursor-pointer hover:bg-slate-50")}
            onClick={(event) => {
              if (!clickable) return;
              // A click on a control inside the row (menu, checkbox, link) is that control's.
              if (
                (event.target as HTMLElement).closest(
                  "button, a, input, [role='menuitem'], [role='checkbox']"
                )
              ) {
                return;
              }
              onRowClick?.(row);
            }}>
            {row.getVisibleCells().map((cell) => (
              <TableCell
                key={cell.id}
                style={{ width: widthOf(cell.column.getSize()) }}
                className={cn(
                  "text-sm text-slate-700",
                  CONTROL_COLUMNS.has(cell.column.id) ? "px-2" : "px-4",
                  isExpanded ? "py-4" : "py-2.5"
                )}>
                <div
                  className={cn(
                    "flex min-w-0 items-center",
                    !isExpanded && !CONTROL_COLUMNS.has(cell.column.id) && "truncate"
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
        <Table className="w-full table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-white">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: widthOf(header.getSize()) }}
                    className={cn(
                      "h-10 text-xs font-medium whitespace-nowrap text-slate-600",
                      CONTROL_COLUMNS.has(header.column.id) ? "px-2" : "px-4"
                    )}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="[&_tr:last-child]:border-0">{renderBody()}</TableBody>
        </Table>
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

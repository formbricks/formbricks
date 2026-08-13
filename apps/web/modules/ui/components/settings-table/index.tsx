import { cn } from "@/lib/cn";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import {
  getBodyCellClassName,
  getFrameClassName,
  getHeaderCellClassName,
  getRowActivatorColumnId,
  isRowActivatable,
} from "./lib/column-classes";
import { SettingsTableSkeletonRows } from "./settings-table-skeleton";
import type { TSettingsTableProps } from "./types";

/**
 * The settings-page table: one frame, a tinted `h-12` header, divided rows.
 *
 * Columns are declared as data rather than JSX so that the header, the cells, the responsive hiding and
 * the loading skeleton all come from one source. Export the array from a `getXColumns(t, flags)` factory
 * and a `loading.tsx` can reuse it, which is what keeps a skeleton from drifting out of sync.
 *
 * Defaults to frameless, because the `<SettingsCard bodyVariant="flush">` it usually sits in already
 * provides the frame. Pass `frame="card"` when the table stands on its own.
 *
 * Deliberately has no `"use client"`: it holds no state, so a server component can render it too. Only
 * the interactive props (`onRowClick`, `getRowProps`) require a client caller.
 *
 * For anything the column API cannot express, drop down to the `Table` parts directly — they carry the
 * same visual defaults, so the escape hatch costs structural consistency but never visual consistency.
 */
export const SettingsTable = <TRow,>({
  columns,
  rows,
  getRowId,
  emptyMessage,
  frame = "none",
  isLoading = false,
  skeletonRows,
  isRowDisabled,
  footer,
  getRowProps,
  bodyProps,
  onRowClick,
  getRowLabel,
  isRowClickable,
  className,
  containerClassName,
  id,
  "aria-label": ariaLabel,
  "data-testid": dataTestId,
}: Readonly<TSettingsTableProps<TRow>>) => {
  const activatorColumnId = getRowActivatorColumnId(columns);

  const renderBody = () => {
    if (isLoading) {
      return <SettingsTableSkeletonRows columns={columns} rows={skeletonRows} />;
    }

    if (rows.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-slate-500">
            {emptyMessage}
          </TableCell>
        </TableRow>
      );
    }

    return rows.map((row, rowIndex) => {
      const isDisabled = isRowDisabled?.(row) ?? false;
      const isClickable = isRowActivatable({
        isDisabled,
        hasRowClick: Boolean(onRowClick),
        isRowClickable: isRowClickable?.(row),
      });

      return (
        <TableRow
          key={getRowId(row)}
          aria-disabled={isDisabled || undefined}
          className={cn(
            isClickable && "cursor-pointer hover:bg-slate-50",
            isDisabled && "pointer-events-none opacity-60"
          )}
          onClick={isClickable && onRowClick ? () => onRowClick(row) : undefined}
          {...getRowProps?.(row)}>
          {columns.map((column) => {
            const content = column.cell(row, rowIndex);

            return (
              <TableCell
                key={column.id}
                className={getBodyCellClassName(column)}
                onClick={column.stopRowClick ? (event) => event.stopPropagation() : undefined}>
                {isClickable && getRowLabel && column.id === activatorColumnId ? (
                  <button
                    type="button"
                    aria-label={getRowLabel(row)}
                    className="-m-1 flex w-full items-center rounded-sm p-1 text-left focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-hidden">
                    {content}
                  </button>
                ) : (
                  content
                )}
              </TableCell>
            );
          })}
        </TableRow>
      );
    });
  };

  return (
    <div className={cn(getFrameClassName(frame), containerClassName)}>
      <Table id={id} aria-label={ariaLabel} data-testid={dataTestId} className={className}>
        <TableHeader>
          <TableRow className="bg-slate-100">
            {columns.map((column) => (
              <TableHead key={column.id} className={getHeaderCellClassName(column)}>
                {column.header}
                {column.header === null && column.srLabel ? (
                  <span className="sr-only">{column.srLabel}</span>
                ) : null}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody {...bodyProps}>{renderBody()}</TableBody>
      </Table>
      {footer}
    </div>
  );
};

export { SettingsTableSkeleton, SettingsTableSkeletonRows } from "./settings-table-skeleton";
export type {
  TSettingsTableAlign,
  TSettingsTableBreakpoint,
  TSettingsTableColumn,
  TSettingsTableFrame,
  TSettingsTableProps,
  TSettingsTableSkeletonProps,
} from "./types";

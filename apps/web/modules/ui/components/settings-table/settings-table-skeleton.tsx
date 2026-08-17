import { cn } from "@/lib/cn";
import { Skeleton } from "@/modules/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { getBodyCellClassName, getFrameClassName, getHeaderCellClassName } from "./lib/column-classes";
import type { TSettingsTableColumn, TSettingsTableSkeletonProps } from "./types";

const DEFAULT_SKELETON_ROWS = 3;

/**
 * Skeleton body rows for a table that is already rendering its own header. Kept separate from
 * `SettingsTableSkeleton` so `SettingsTable`'s `isLoading` state can swap only the body and leave the
 * real header in place.
 */
export const SettingsTableSkeletonRows = <TRow,>({
  columns,
  rows = DEFAULT_SKELETON_ROWS,
}: Readonly<{ columns: TSettingsTableColumn<TRow>[]; rows?: number }>) => (
  <>
    {Array.from({ length: rows }, (_, rowIndex) => (
      <TableRow key={`settings-table-skeleton-row-${rowIndex}`}>
        {columns.map((column) => (
          <TableCell key={column.id} className={getBodyCellClassName(column)}>
            <Skeleton className={cn("h-4 rounded-xl", column.skeletonWidth ?? "w-24")} />
          </TableCell>
        ))}
      </TableRow>
    ))}
  </>
);

/**
 * A full loading table for `loading.tsx` files. Pass the **same column array** the real table uses —
 * importing it from a shared `getXColumns(t, flags)` factory is what stops the skeleton drifting out of
 * sync with the table it stands in for.
 */
export const SettingsTableSkeleton = <TRow,>({
  columns,
  frame = "none",
  rows = DEFAULT_SKELETON_ROWS,
  className,
  containerClassName,
}: Readonly<TSettingsTableSkeletonProps<TRow>>) => (
  <div className={cn(getFrameClassName(frame), containerClassName)}>
    <Table className={className}>
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
      <TableBody>
        <SettingsTableSkeletonRows columns={columns} rows={rows} />
      </TableBody>
    </Table>
  </div>
);

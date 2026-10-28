"use client";

import type { ColumnSizingState, OnChangeFn, VisibilityState } from "@tanstack/react-table";
import { useCallback, useEffect, useState } from "react";
import { reconcileColumnOrder, reconcileColumnVisibility } from "../lib/column-state";

const readJson = <T>(key: string): T | null => {
  try {
    const raw = globalThis.window.localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown) => {
  try {
    globalThis.window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A full or blocked storage only loses the remembered layout, never the table.
  }
};

/**
 * Column widths a user dragged, remembered per browser under `storageKey`. Spread the result into
 * `useReactTable`; `ListTable` draws the resize handles for any table that enables it.
 */
export const useColumnSizing = (storageKey: string) => {
  const [columnSizing, setColumnSizingState] = useState<ColumnSizingState>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setColumnSizingState(readJson<ColumnSizingState>(storageKey) ?? {});
    setIsLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (isLoaded) writeJson(storageKey, columnSizing);
  }, [isLoaded, storageKey, columnSizing]);

  const onColumnSizingChange: OnChangeFn<ColumnSizingState> = setColumnSizingState;
  return {
    columnSizing,
    tableOptions: {
      enableColumnResizing: true,
      columnResizeMode: "onChange" as const,
      onColumnSizingChange,
    },
  };
};

/**
 * Column order, visibility and row height for one table, remembered per browser under
 * `${storagePrefix}-columnOrder` / `-columnVisibility` / `-rowExpand`. Those are the keys the tables
 * used before this hook, so nobody loses a saved layout (decision Q26).
 *
 * `columnIds` may change after mount (Contacts grows a column per attribute key): a new column is
 * appended at its default visibility, a column that is gone is dropped from the saved order.
 */
export const useTableColumnState = ({
  storagePrefix,
  columnIds,
  defaultVisibility,
}: {
  storagePrefix: string;
  columnIds: readonly string[];
  /** Visibility for a column with nothing saved; absent ids are visible. */
  defaultVisibility?: VisibilityState;
}) => {
  const [columnOrder, setColumnOrder] = useState<string[]>([...columnIds]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const sizing = useColumnSizing(`${storagePrefix}-columnSizing`);
  const columnKey = columnIds.join("|");

  useEffect(() => {
    const savedOrder = readJson<string[]>(`${storagePrefix}-columnOrder`);
    const savedVisibility = readJson<VisibilityState>(`${storagePrefix}-columnVisibility`);
    const savedExpanded = readJson<boolean>(`${storagePrefix}-rowExpand`);
    setColumnOrder(reconcileColumnOrder(savedOrder, columnIds));
    setColumnVisibility(reconcileColumnVisibility(savedVisibility, columnIds, defaultVisibility));
    if (typeof savedExpanded === "boolean") setIsExpanded(savedExpanded);
    setIsLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `columnKey` stands in for `columnIds`; defaults only seed new columns
  }, [storagePrefix, columnKey]);

  useEffect(() => {
    if (!isLoaded) return;
    writeJson(`${storagePrefix}-columnOrder`, columnOrder);
    writeJson(`${storagePrefix}-columnVisibility`, columnVisibility);
    writeJson(`${storagePrefix}-rowExpand`, isExpanded);
  }, [isLoaded, storagePrefix, columnOrder, columnVisibility, isExpanded]);

  const moveColumn = useCallback((activeId: string, overId: string) => {
    setColumnOrder((order) => {
      const from = order.indexOf(activeId);
      const to = order.indexOf(overId);
      if (from === -1 || to === -1 || from === to) return order;
      const next = [...order];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  }, []);

  return {
    columnOrder,
    setColumnOrder,
    columnVisibility,
    setColumnVisibility,
    isExpanded,
    setIsExpanded,
    moveColumn,
    columnSizing: sizing.columnSizing,
    /** Spread into `useReactTable` so its columns can be resized. */
    sizingOptions: sizing.tableOptions,
  };
};

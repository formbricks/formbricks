import type { VisibilityState } from "@tanstack/react-table";
import type { TTableColumnSetting } from "../components/table-settings-popover";

export type TColumnLabel = { id: string; label: string };

/**
 * The gear's column list, in display order: every labelled column with its visibility. Columns in
 * `lockedIds` cannot be hidden or moved; columns with no label (selection, row actions) are left out.
 */
export const buildColumnSettings = (
  labels: readonly TColumnLabel[],
  columnOrder: readonly string[],
  columnVisibility: VisibilityState,
  lockedIds: readonly string[] = []
): TTableColumnSetting[] => {
  const labelById = new Map(labels.map((column) => [column.id, column.label]));
  const ordered = [
    ...columnOrder.filter((id) => labelById.has(id)),
    ...labels.map((column) => column.id).filter((id) => !columnOrder.includes(id)),
  ];
  return ordered.map((id) => ({
    id,
    label: labelById.get(id) ?? id,
    visible: lockedIds.includes(id) || columnVisibility[id] !== false,
    locked: lockedIds.includes(id),
  }));
};

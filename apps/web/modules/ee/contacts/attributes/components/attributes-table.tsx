"use client";

import { keepPreviousData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { TFunction } from "i18next";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import type { TUserLocale } from "@formbricks/types/user";
import { getFormattedErrorMessage } from "@/lib/utils/error-message";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { SelectedRowSettings } from "@/modules/ui/components/data-table/components/selected-row-settings";
import { ListTable, TableToolbar } from "@/modules/ui/components/table-toolbar";
import { useTableColumnState } from "@/modules/ui/components/table-toolbar/hooks/use-table-column-state";
import { useTableUrlState } from "@/modules/ui/components/table-toolbar/hooks/use-table-url-state";
import { buildColumnSettings } from "@/modules/ui/components/table-toolbar/lib/column-settings";
import { contactQueryKeys } from "../../lib/query-keys";
import { deleteContactAttributeKeyAction } from "../actions";
import {
  ATTRIBUTE_SORT_VALUES,
  DEFAULT_ATTRIBUTE_SORT,
  getAttributeFilterProperties,
  getAttributeSortOptions,
  toAttributeListParams,
} from "../lib/table-filters";
import { listAttributeKeys } from "../lib/v3-attribute-keys-client";
import { generateAttributeTableColumns } from "./attribute-table-column";
import { EditAttributeModal } from "./edit-attribute-modal";

const ATTRIBUTES_PER_PAGE = 50;

interface AttributesTableProps {
  isReadOnly: boolean;
  workspaceId: string;
  locale: TUserLocale;
}

/** Only custom attributes can be deleted, so a default one shows no checkbox at all. */
const withCustomOnlySelection = (
  generated: ColumnDef<TContactAttributeKey>[],
  t: TFunction
): ColumnDef<TContactAttributeKey>[] =>
  generated.map((column) =>
    column.id === "select"
      ? {
          ...column,
          cell: ({ row }) =>
            // Same wrapper as the header checkbox, so the column lines up.
            row.getCanSelect() ? (
              <div className="flex w-full items-center justify-center pr-4">
                <Checkbox
                  checked={row.getIsSelected()}
                  onCheckedChange={(value) => row.toggleSelected(!!value)}
                  aria-label={t("common.table_toolbar.select_row")}
                />
              </div>
            ) : null,
        }
      : column
  );

/** Contact attributes on the shared table toolbar, filtered and sorted on the server. */
export const AttributesTable = ({ isReadOnly, workspaceId, locale }: Readonly<AttributesTableProps>) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [editingAttribute, setEditingAttribute] = useState<TContactAttributeKey | null>(null);

  const filterProperties = getAttributeFilterProperties(t);
  const tableState = useTableUrlState({
    properties: filterProperties,
    sortOptions: ATTRIBUTE_SORT_VALUES,
    defaultSortBy: DEFAULT_ATTRIBUTE_SORT,
  });
  const filtersKey = JSON.stringify(tableState.filters);
  // Memoized so the rows below stay the same array between renders; the table resets its state, and
  // renders again, whenever it is handed a new one.
  const listParams = useMemo(
    () => toAttributeListParams(tableState.filters, tableState.search, tableState.sortBy),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `filtersKey` stands in for the filter list
    [filtersKey, tableState.search, tableState.sortBy]
  );
  const hasFilters = tableState.filters.length > 0 || tableState.search.trim().length > 0;

  const query = useInfiniteQuery({
    queryKey: contactQueryKeys.attributeKeyList(workspaceId, listParams),
    initialPageParam: null as string | null,
    enabled: listParams !== null,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam, signal }) =>
      listAttributeKeys({
        workspaceId,
        limit: ATTRIBUTES_PER_PAGE,
        cursor: pageParam,
        params: listParams!,
        signal,
      }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  });

  const attributes = useMemo(
    () => (listParams === null ? [] : (query.data?.pages ?? []).flatMap((page) => page.data)),
    [query.data, listParams]
  );
  const matchCount = listParams === null ? 0 : (query.data?.pages[0]?.meta.totalCount ?? null);
  const columnState = useTableColumnState({
    storagePrefix: `${workspaceId}-attributes`,
    columnIds: ["select", "createdAt", "name", "key", "description", "dataType", "updatedAt"],
  });

  const columns = useMemo<ColumnDef<TContactAttributeKey>[]>(() => {
    const generated = generateAttributeTableColumns(
      tableState.search,
      isReadOnly,
      columnState.isExpanded,
      t,
      locale
    );
    return withCustomOnlySelection(generated, t);
  }, [tableState.search, isReadOnly, columnState.isExpanded, t, locale]);

  const table = useReactTable({
    data: attributes,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: (row) => !isReadOnly && row.original.type === "custom",
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
      columnOrder: columnState.columnOrder,
      columnVisibility: columnState.columnVisibility,
    },
  });

  const columnLabels = [
    { id: "createdAt", label: t("common.created_at") },
    { id: "name", label: t("common.label") },
    { id: "key", label: t("common.key") },
    { id: "description", label: t("common.description") },
    { id: "dataType", label: t("common.table_toolbar.data_type") },
    { id: "updatedAt", label: t("common.updated_at") },
  ];

  const deleteAttribute = async (attributeId: string) => {
    const response = await deleteContactAttributeKeyAction({ id: attributeId });
    if (!response?.data) {
      throw new Error(getFormattedErrorMessage(response));
    }
  };

  const hasSelection = Object.values(rowSelection).some(Boolean);

  return (
    <div className="space-y-3">
      <TableToolbar
        settings={{
          sort: {
            options: getAttributeSortOptions(t),
            value: tableState.sortBy,
            onChange: tableState.setSortBy,
          },
          toggles: [
            {
              id: "expand-rows",
              label: t("common.expand_rows"),
              checked: columnState.isExpanded,
              onCheckedChange: columnState.setIsExpanded,
            },
          ],
          columns: {
            items: buildColumnSettings(columnLabels, columnState.columnOrder, columnState.columnVisibility, [
              "name",
            ]),
            onVisibilityChange: (id, visible) =>
              columnState.setColumnVisibility((current) => ({ ...current, [id]: visible })),
            onMove: columnState.moveColumn,
          },
        }}
        search={{
          value: tableState.search,
          onChange: tableState.setSearch,
          placeholder: t("workspace.contacts.search_attribute_keys"),
        }}
        filter={{
          properties: filterProperties,
          filters: tableState.filters,
          onFiltersChange: (next) => {
            setRowSelection({});
            tableState.setFilters(next);
          },
        }}
        matchCount={{ count: matchCount }}
        selectionContent={
          hasSelection ? (
            <SelectedRowSettings
              table={table}
              updateRowList={() => {
                setRowSelection({});
                void queryClient.invalidateQueries({ queryKey: contactQueryKeys.all });
              }}
              type="attribute"
              deleteAction={deleteAttribute}
              isQuotasAllowed={false}
            />
          ) : undefined
        }
        isLoading={query.isLoading}
      />
      {query.isError && attributes.length === 0 ? (
        <div className="flex w-full flex-col items-center justify-center gap-4 rounded-xl border border-slate-200 bg-white py-16 text-slate-600">
          <p>{getV3ApiErrorMessage(query.error, t("common.something_went_wrong_please_try_again"))}</p>
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            {t("common.try_again")}
          </Button>
        </div>
      ) : (
        <ListTable
          table={table}
          testId="attributes-table"
          isLoading={listParams !== null && query.isLoading}
          hasFilters={hasFilters}
          onClearFilters={tableState.clearFilters}
          isRowClickable={(row) => !isReadOnly && row.original.type === "custom"}
          onRowClick={(row) => setEditingAttribute(row.original)}
          isExpanded={columnState.isExpanded}
          hasNextPage={listParams !== null && query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
        />
      )}
      {editingAttribute && (
        <EditAttributeModal
          attribute={editingAttribute}
          open={!!editingAttribute}
          setOpen={(open) => {
            if (!open) setEditingAttribute(null);
          }}
        />
      )}
    </div>
  );
};

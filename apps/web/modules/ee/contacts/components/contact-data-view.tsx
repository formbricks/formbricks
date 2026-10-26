"use client";

import { keepPreviousData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { RefreshCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import type { TUserLocale } from "@formbricks/types/user";
import { useOrganization } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { getReportingTimeZone } from "@/lib/date-ranges";
import { getFormattedErrorMessage } from "@/lib/utils/error-message";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { deleteContactAction } from "@/modules/ee/contacts/actions";
import { Button } from "@/modules/ui/components/button";
import { SelectedRowSettings } from "@/modules/ui/components/data-table/components/selected-row-settings";
import { ListTable, TableToolbar } from "@/modules/ui/components/table-toolbar";
import { useTableColumnState } from "@/modules/ui/components/table-toolbar/hooks/use-table-column-state";
import { useTableUrlState } from "@/modules/ui/components/table-toolbar/hooks/use-table-url-state";
import { buildColumnSettings } from "@/modules/ui/components/table-toolbar/lib/column-settings";
import { contactQueryKeys } from "../lib/query-keys";
import {
  CONTACT_SORT_VALUES,
  DEFAULT_CONTACT_SORT,
  getContactFilterProperties,
  getContactSortOptions,
  toContactListParams,
} from "../lib/table-filters";
import { listContactAttributeValues, listContacts } from "../lib/v3-contacts-client";
import type { TContactTableData } from "../types/contact";
import { generateContactTableColumns } from "./contact-table-column";

const BUILT_IN_ATTRIBUTE_KEYS = new Set(["userId", "email", "firstName", "lastName"]);

interface ContactDataViewProps {
  workspaceId: string;
  contactAttributeKeys: TContactAttributeKey[];
  itemsPerPage: number;
  isReadOnly: boolean;
  isQuotasAllowed: boolean;
}

/** Contacts on the shared table toolbar: filter by any attribute (ENG-3542), on the server. */
export const ContactDataView = ({
  workspaceId,
  itemsPerPage,
  contactAttributeKeys,
  isReadOnly,
  isQuotasAllowed,
}: Readonly<ContactDataViewProps>) => {
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? "en-US") as TUserLocale;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  const timeZone = getReportingTimeZone(organization?.displayTimeZone);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const customAttributeKeys = useMemo(
    () => contactAttributeKeys.filter((attributeKey) => !BUILT_IN_ATTRIBUTE_KEYS.has(attributeKey.key)),
    [contactAttributeKeys]
  );

  const filterProperties = getContactFilterProperties(t, contactAttributeKeys, async (key, search) => {
    const values = await listContactAttributeValues({ workspaceId, key, search });
    return values.map((value) => ({ value, label: value }));
  });
  const tableState = useTableUrlState({
    properties: filterProperties,
    sortOptions: CONTACT_SORT_VALUES,
    defaultSortBy: DEFAULT_CONTACT_SORT,
  });
  const filtersKey = JSON.stringify(tableState.filters);
  // Resolved once per change: a relative date preset resolved on every render would refetch each time.
  const listParams = useMemo(
    () => toContactListParams(tableState.filters, tableState.search, tableState.sortBy, timeZone),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `filtersKey` stands in for the filter list
    [filtersKey, tableState.search, tableState.sortBy, timeZone]
  );
  const hasFilters = tableState.filters.length > 0 || tableState.search.trim().length > 0;

  const query = useInfiniteQuery({
    queryKey: contactQueryKeys.contactList(workspaceId, listParams),
    initialPageParam: null as string | null,
    enabled: listParams !== null,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam, signal }) =>
      listContacts({ workspaceId, limit: itemsPerPage, cursor: pageParam, params: listParams!, signal }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  });

  const data: TContactTableData[] = useMemo(() => {
    if (listParams === null) return [];
    return (query.data?.pages ?? []).flatMap((page) =>
      page.data.map((contact) => {
        const values = new Map(contact.attributes.map((attribute) => [attribute.key, attribute.value]));
        return {
          id: contact.id,
          userId: contact.userId ?? "",
          email: contact.email ?? "",
          firstName: contact.firstName ?? "",
          lastName: contact.lastName ?? "",
          attributes: customAttributeKeys.map((attributeKey) => ({
            key: attributeKey.key,
            name: attributeKey.name,
            value: values.get(attributeKey.key) ?? "",
            dataType: attributeKey.dataType,
          })),
        };
      })
    );
  }, [query.data, listParams, customAttributeKeys]);
  const matchCount = listParams === null ? 0 : (query.data?.pages[0]?.meta.totalCount ?? null);

  const columns = useMemo(
    () => generateContactTableColumns(tableState.search, customAttributeKeys, isReadOnly, locale, t),
    [tableState.search, customAttributeKeys, isReadOnly, locale, t]
  );
  const columnIds = useMemo(() => columns.map((column) => column.id ?? ""), [columns]);
  const columnState = useTableColumnState({
    storagePrefix: workspaceId,
    columnIds,
    // As before: the built-in identity columns show, custom attributes start hidden.
    defaultVisibility: Object.fromEntries(
      customAttributeKeys.map((attributeKey) => [attributeKey.key, false] as const)
    ),
  });

  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: !isReadOnly,
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
      columnOrder: columnState.columnOrder,
      columnVisibility: columnState.columnVisibility,
    },
  });

  const columnLabels = [
    { id: "contactsTableUser", label: t("common.id") },
    { id: "userId", label: t("common.user_id") },
    { id: "email", label: t("common.email") },
    { id: "firstName", label: t("common.first_name") },
    { id: "lastName", label: t("common.last_name") },
    ...customAttributeKeys.map((attributeKey) => ({
      id: attributeKey.key,
      label: attributeKey.name ?? attributeKey.key,
    })),
  ];

  const refreshContacts = async () => {
    await queryClient.invalidateQueries({ queryKey: contactQueryKeys.all });
  };

  const deleteContact = async (contactId: string) => {
    const result = await deleteContactAction({ contactId });
    if (result?.serverError) {
      throw new Error(getFormattedErrorMessage(result));
    }
  };

  const hasSelection = Object.values(rowSelection).some(Boolean);

  return (
    <div className="space-y-3">
      <TableToolbar
        settings={{
          sort: {
            options: getContactSortOptions(t),
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
              "contactsTableUser",
            ]),
            onVisibilityChange: (id, visible) =>
              columnState.setColumnVisibility((current) => ({ ...current, [id]: visible })),
            onMove: columnState.moveColumn,
          },
        }}
        search={{
          value: tableState.search,
          onChange: tableState.setSearch,
          placeholder: t("workspace.contacts.search_contact"),
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
                void refreshContacts();
              }}
              type="contact"
              deleteAction={deleteContact}
              isQuotasAllowed={isQuotasAllowed}
            />
          ) : undefined
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            aria-label={t("common.refresh")}
            onClick={async () => {
              await refreshContacts();
              toast.success(t("common.data_refreshed_successfully"));
            }}>
            <RefreshCcwIcon className="size-3.5" />
          </Button>
        }
        isLoading={query.isLoading}
      />
      {query.isError && data.length === 0 ? (
        <div className="flex w-full flex-col items-center justify-center gap-4 rounded-xl border border-slate-200 bg-white py-16 text-slate-600">
          <p>{getV3ApiErrorMessage(query.error, t("common.something_went_wrong_please_try_again"))}</p>
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            {t("common.try_again")}
          </Button>
        </div>
      ) : (
        <ListTable
          table={table}
          testId="contacts-table"
          isLoading={listParams !== null && query.isLoading}
          hasFilters={hasFilters}
          onClearFilters={tableState.clearFilters}
          onRowClick={(row) => router.push(`/workspaces/${workspaceId}/contacts/${row.original.id}`)}
          isExpanded={columnState.isExpanded}
          hasNextPage={listParams !== null && query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
        />
      )}
    </div>
  );
};

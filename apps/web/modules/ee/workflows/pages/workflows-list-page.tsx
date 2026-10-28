"use client";

import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { TFunction } from "i18next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TWorkflowListItem, TWorkflowSortBy, TWorkflowStatus } from "@formbricks/workflows";
import { removeStaleFilterStorage } from "@/lib/stale-filter-storage";
import { timeSince } from "@/lib/time";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import { ListTable, TableToolbar } from "@/modules/ui/components/table-toolbar";
import { useTableColumnState } from "@/modules/ui/components/table-toolbar/hooks/use-table-column-state";
import { useTableUrlState } from "@/modules/ui/components/table-toolbar/hooks/use-table-url-state";
import { buildColumnSettings } from "@/modules/ui/components/table-toolbar/lib/column-settings";
import { WorkflowListActions } from "../components/workflow-list-actions";
import { WorkflowStatusPill } from "../components/workflow-status-pill";
import { WorkflowsEmptyState } from "../components/workflows-empty-state";
import { useTrackWorkflowListFilters } from "../hooks/use-track-workflow-list-filters";
import { useTrackWorkflowSurface } from "../hooks/use-track-workflow-surface";
import { useWorkflows } from "../hooks/use-workflows";
import { resolveWorkflowListSurface } from "../lib/analytics";
import type { workflowKeys } from "../lib/query";
import {
  DEFAULT_WORKFLOW_SORT,
  WORKFLOW_SORT_VALUES,
  getWorkflowFilterProperties,
  getWorkflowSortOptions,
  isShowingArchived,
  setShowArchived,
  toWorkflowStatusIn,
} from "../lib/table-filters";

// One shared empty list, so a filter that matches nothing does not hand the table a new array each render.
const NO_WORKFLOWS: TWorkflowListItem[] = [];

interface WorkflowsListPageProps {
  workspaceId: string;
  isReadOnly: boolean;
  workflowsPerPage: number;
}

const WORKFLOW_COLUMN_IDS = ["name", "status", "runs", "createdAt", "updatedAt", "createdBy", "actions"];

/** The Workflows list as a real table on the shared toolbar (ENG-3541). */
/** The table's columns, built outside the component so each cell renderer is not a nested component. */
const getWorkflowColumns = ({
  t,
  locale,
  workspaceId,
  isReadOnly,
  queryKey,
}: {
  t: TFunction;
  locale: string;
  workspaceId: string;
  isReadOnly: boolean;
  queryKey: ReturnType<typeof workflowKeys.list>;
}): ColumnDef<TWorkflowListItem>[] => [
  {
    id: "name",
    header: t("common.name"),
    size: 300,
    cell: ({ row }) => (
      <Link
        href={`/workspaces/${workspaceId}/workflows/${row.original.id}`}
        className="focus-visible:ring-ring min-w-0 truncate font-medium text-slate-900 hover:underline focus-visible:ring-1 focus-visible:outline-hidden">
        {row.original.name}
      </Link>
    ),
  },
  {
    id: "status",
    header: t("common.status"),
    size: 140,
    cell: ({ row }) => <WorkflowStatusPill status={row.original.status} />,
  },
  {
    id: "runs",
    header: t("common.runs"),
    size: 100,
    cell: ({ row }) => <span className="text-slate-900">{row.original.runCount}</span>,
  },
  {
    id: "createdAt",
    header: t("common.created_at"),
    size: 130,
    cell: ({ row }) => (
      <span className="truncate text-slate-500">{timeSince(row.original.createdAt, locale)}</span>
    ),
  },
  {
    id: "updatedAt",
    header: t("common.updated_at"),
    size: 130,
    cell: ({ row }) => (
      <span className="truncate text-slate-500">{timeSince(row.original.updatedAt, locale)}</span>
    ),
  },
  {
    id: "createdBy",
    header: t("common.created_by"),
    size: 150,
    cell: ({ row }) => <span className="truncate text-slate-500">{row.original.creator?.name ?? "—"}</span>,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">{t("common.actions")}</span>,
    size: 64,
    cell: ({ row }) => (
      <div className="flex w-full justify-end">
        <WorkflowListActions
          workflowId={row.original.id}
          workflowName={row.original.name}
          status={row.original.status}
          workspaceId={workspaceId}
          isReadOnly={isReadOnly}
          queryKey={queryKey}
        />
      </div>
    ),
  },
];

export const WorkflowsListPage = ({
  workspaceId,
  isReadOnly,
  workflowsPerPage,
}: Readonly<WorkflowsListPageProps>) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";

  useEffect(() => removeStaleFilterStorage(globalThis.window?.localStorage), []);

  const filterProperties = getWorkflowFilterProperties(t);
  const tableState = useTableUrlState({
    properties: filterProperties,
    sortOptions: WORKFLOW_SORT_VALUES,
    defaultSortBy: DEFAULT_WORKFLOW_SORT,
  });
  const sortBy = tableState.sortBy as TWorkflowSortBy;
  const statusIn = toWorkflowStatusIn(tableState.filters);
  const nameContains = tableState.search.trim();
  const hasActiveFilters = tableState.filters.length > 0 || nameContains.length > 0;
  const columnState = useTableColumnState({
    storagePrefix: `${workspaceId}-workflows`,
    columnIds: WORKFLOW_COLUMN_IDS,
  });

  // Held steady per value: the tracking hook keys its effect on this list, so a fresh array each
  // render would report the same filter on every render.
  const statusKey = (statusIn ?? []).join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the joined statuses
  const selectedStatuses = useMemo<TWorkflowStatus[]>(() => statusIn ?? [], [statusKey]);
  // The URL is the settled state: search is already debounced by the toolbar before it lands there.
  useTrackWorkflowListFilters({
    isFilterInitialized: true,
    searchValue: nameContains,
    debouncedSearchValue: nameContains,
    selectedStatuses,
    sortBy,
  });

  const {
    workflows,
    isLoading,
    isError,
    error,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    queryKey,
    totalCount,
  } = useWorkflows({
    workspaceId,
    limit: workflowsPerPage,
    nameContains,
    statusIn: statusIn ?? undefined,
    sortBy,
    // Filters that exclude every status cannot match anything; there is nothing to ask the API.
    enabled: statusIn !== null,
  });

  const rows = statusIn === null ? NO_WORKFLOWS : workflows;
  const showInitialLoading = statusIn !== null && isLoading && workflows.length === 0;

  // Reported once per screen the user lands on; `null` while loading or erroring, neither of which
  // is a visit. `hasActiveFilters` is what separates an empty workspace from an emptied filter.
  useTrackWorkflowSurface(
    resolveWorkflowListSurface({
      showInitialLoading,
      isError,
      hasActiveFilters,
      workflowCount: rows.length,
    })
  );

  const columnLabels = [
    { id: "name", label: t("common.name") },
    { id: "status", label: t("common.status") },
    { id: "runs", label: t("common.runs") },
    { id: "createdAt", label: t("common.created_at") },
    { id: "updatedAt", label: t("common.updated_at") },
    { id: "createdBy", label: t("common.created_by") },
  ];

  const columns = useMemo(
    () => getWorkflowColumns({ t, locale, workspaceId, isReadOnly, queryKey }),
    [t, locale, workspaceId, isReadOnly, queryKey]
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (workflow) => workflow.id,
    getCoreRowModel: getCoreRowModel(),
    state: { columnOrder: columnState.columnOrder, columnVisibility: columnState.columnVisibility },
  });

  return (
    <div className="space-y-3">
      <TableToolbar
        settings={{
          sort: {
            options: getWorkflowSortOptions(t),
            value: tableState.sortBy,
            onChange: tableState.setSortBy,
          },
          toggles: [
            {
              id: "show-archived",
              label: t("common.table_toolbar.show_archived"),
              checked: isShowingArchived(tableState.filters),
              onCheckedChange: (checked) =>
                tableState.setFilters(setShowArchived(tableState.filters, checked)),
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
          placeholder: t("workspace.workflows.search_by_workflow_name"),
        }}
        filter={{
          properties: filterProperties,
          filters: tableState.filters,
          onFiltersChange: tableState.setFilters,
        }}
        matchCount={{ count: statusIn === null ? 0 : totalCount }}
        isLoading={isLoading}
      />
      {isError && rows.length === 0 ? (
        <div className="flex w-full flex-col items-center justify-center gap-4 py-16 text-slate-600">
          <p>{getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"))}</p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            {t("common.try_again")}
          </Button>
        </div>
      ) : (
        <ListTable
          table={table}
          testId="workflows-list-table"
          isLoading={showInitialLoading}
          hasFilters={hasActiveFilters}
          onClearFilters={tableState.clearFilters}
          onRowClick={(row) => router.push(`/workspaces/${workspaceId}/workflows/${row.original.id}`)}
          emptyContent={<WorkflowsEmptyState filtered={false} />}
          hasNextPage={statusIn !== null && Boolean(hasNextPage)}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={() => void fetchNextPage()}
        />
      )}
    </div>
  );
};

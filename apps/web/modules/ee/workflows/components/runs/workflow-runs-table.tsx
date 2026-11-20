"use client";

import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { timeSince } from "@/lib/time";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { useWorkflowRuns } from "@/modules/ee/workflows/hooks/use-workflow-runs";
import { trackWorkflowEvent } from "@/modules/ee/workflows/lib/analytics";
import { WORKFLOW_CLIENT_EVENTS } from "@/modules/ee/workflows/lib/analytics-events";
import { getWorkflowRunStatusBadge, getWorkflowTriggerTypeLabel } from "@/modules/ee/workflows/lib/display";
import {
  DEFAULT_RUN_SORT,
  RUN_SORT_VALUES,
  SHOW_TEST_RUNS_PROPERTY,
  getRunFilterProperties,
  isShowingTestRuns,
  setHideTestRuns,
  toRunListFilters,
} from "@/modules/ee/workflows/lib/run-table-filters";
import { type TWorkflowRunListItem } from "@/modules/ee/workflows/types";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { ListTable, TableToolbar } from "@/modules/ui/components/table-toolbar";
import { useTableColumnState } from "@/modules/ui/components/table-toolbar/hooks/use-table-column-state";
import { useTableUrlState } from "@/modules/ui/components/table-toolbar/hooks/use-table-url-state";
import { buildColumnSettings } from "@/modules/ui/components/table-toolbar/lib/column-settings";
import { WorkflowRunDetailDrawer } from "./workflow-run-detail-drawer";

const RUNS_PER_PAGE = 20;
const NO_RUNS: TWorkflowRunListItem[] = [];

interface WorkflowRunsTableProps {
  workspaceId: string;
  /** One workflow's runs (its Runs tab); omitted, every workflow's runs in the workspace. */
  workflowId?: string;
}

const TestBadge = ({ run }: Readonly<{ run: TWorkflowRunListItem }>) => {
  const { t } = useTranslation();
  return run.isDryRun ? (
    <Badge text={t("workspace.workflows.run_test_badge")} type="gray" size="tiny" />
  ) : null;
};

const formatTime = (value: string | null, locale: string, t: TFunction) =>
  value ? timeSince(value, locale) : t("common.not_set");

/**
 * The columns. Inside one workflow every run has its trigger, so that list has no Trigger column and
 * marks a Test run next to its status; across workflows the workflow's name leads.
 */
const getRunColumns = (
  t: TFunction,
  locale: string,
  isWorkspaceScope: boolean
): ColumnDef<TWorkflowRunListItem>[] => {
  const status: ColumnDef<TWorkflowRunListItem> = {
    id: "status",
    header: t("common.status"),
    size: 160,
    cell: ({ row }) => {
      const badge = getWorkflowRunStatusBadge(row.original.status, t);
      return (
        <span className="flex items-center gap-2">
          <Badge text={badge.label} type={badge.type} size="tiny" />
          {isWorkspaceScope ? null : <TestBadge run={row.original} />}
        </span>
      );
    },
  };
  const times: ColumnDef<TWorkflowRunListItem>[] = [
    {
      id: "startedAt",
      header: t("common.started_at"),
      size: 150,
      cell: ({ row }) => (
        <span className="truncate text-slate-600">{formatTime(row.original.startedAt, locale, t)}</span>
      ),
    },
    {
      id: "finishedAt",
      header: t("common.finished_at"),
      size: 150,
      cell: ({ row }) => (
        <span className="truncate text-slate-600">{formatTime(row.original.finishedAt, locale, t)}</span>
      ),
    },
  ];
  if (!isWorkspaceScope) return [status, ...times];
  return [
    {
      id: "workflow",
      header: t("common.workflow_name"),
      size: 300,
      cell: ({ row }) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-slate-900">{row.original.workflowName}</span>
          <TestBadge run={row.original} />
        </span>
      ),
    },
    {
      id: "trigger",
      header: t("common.trigger"),
      size: 170,
      cell: ({ row }) => (
        <span className="truncate text-slate-600">
          {getWorkflowTriggerTypeLabel(row.original.triggerType, t)}
        </span>
      ),
    },
    status,
    ...times,
  ];
};

/**
 * A runs list on the shared table toolbar, as the Workflows list has it (ENG review of #10010): Status,
 * and across workflows Trigger, as filters; "Hide test runs" in the gear, on by default. A row opens the
 * run's detail drawer.
 */
export const WorkflowRunsTable = ({ workspaceId, workflowId }: Readonly<WorkflowRunsTableProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const isWorkspaceScope = workflowId === undefined;
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const filterProperties = getRunFilterProperties(t, { withTrigger: isWorkspaceScope });
  const tableState = useTableUrlState({
    properties: filterProperties,
    sortOptions: RUN_SORT_VALUES,
    defaultSortBy: DEFAULT_RUN_SORT,
  });
  const listFilters = toRunListFilters(tableState.filters, workflowId ? { workflowId } : {});
  const hasActiveFilters = tableState.filters.some((filter) => filter.property !== SHOW_TEST_RUNS_PROPERTY);

  const {
    runs,
    isLoading,
    isError,
    error,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isFetchNextPageError,
  } = useWorkflowRuns({
    workspaceId,
    limit: RUNS_PER_PAGE,
    filters: listFilters ?? undefined,
    // Filters that exclude every status or trigger cannot match anything; there is nothing to ask.
    enabled: listFilters !== null,
  });
  const rows = listFilters === null ? NO_RUNS : runs;

  const columns = useMemo(() => getRunColumns(t, locale, isWorkspaceScope), [t, locale, isWorkspaceScope]);
  // The gear's column list, read off the columns themselves (every header here is its label).
  const columnLabels = columns.map((column) => ({ id: column.id ?? "", label: String(column.header) }));
  const columnState = useTableColumnState({
    storagePrefix: `${workspaceId}-${isWorkspaceScope ? "workspace" : "workflow"}-runs`,
    columnIds: columnLabels.map((column) => column.id),
  });
  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (run) => run.id,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnOrder: columnState.columnOrder,
      columnVisibility: columnState.columnVisibility,
      columnSizing: columnState.columnSizing,
    },
    ...columnState.sizingOptions,
  });

  const openRun = (run: TWorkflowRunListItem) => {
    trackWorkflowEvent(WORKFLOW_CLIENT_EVENTS.runDetailOpened, {
      run_id: run.id,
      workflow_id: run.workflowId,
      run_status: run.status,
      scope: isWorkspaceScope ? "workspace" : "workflow",
    });
    setSelectedRunId(run.id);
  };
  const selectedRun = rows.find((run) => run.id === selectedRunId) ?? null;

  return (
    <div className="space-y-3">
      <TableToolbar
        settings={{
          toggles: [
            {
              id: "hide-test-runs",
              label: t("workspace.workflows.hide_test_runs"),
              checked: !isShowingTestRuns(tableState.filters),
              onCheckedChange: (checked) =>
                tableState.setFilters(setHideTestRuns(tableState.filters, checked)),
            },
          ],
          columns: {
            items: buildColumnSettings(columnLabels, columnState.columnOrder, columnState.columnVisibility, [
              isWorkspaceScope ? "workflow" : "status",
            ]),
            onVisibilityChange: (id, visible) =>
              columnState.setColumnVisibility((current) => ({ ...current, [id]: visible })),
            onMove: columnState.moveColumn,
          },
        }}
        filter={{
          properties: filterProperties,
          filters: tableState.filters,
          onFiltersChange: tableState.setFilters,
        }}
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
          testId={isWorkspaceScope ? "workspace-runs-table" : "workflow-runs-table"}
          isLoading={listFilters !== null && isLoading && rows.length === 0}
          hasFilters={hasActiveFilters}
          onClearFilters={tableState.clearFilters}
          onRowClick={(row) => openRun(row.original)}
          emptyContent={<p className="text-slate-400">{t("common.no_results")}</p>}
          hasNextPage={listFilters !== null && Boolean(hasNextPage)}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={() => void fetchNextPage()}
        />
      )}
      {/* A failed load-more keeps the rows already loaded; say so, and Load more tries again. */}
      {isFetchNextPageError ? (
        <p className="text-center text-sm text-red-600">
          {getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"))}
        </p>
      ) : null}
      <WorkflowRunDetailDrawer
        run={selectedRun}
        open={selectedRun !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedRunId(null);
        }}
      />
    </div>
  );
};

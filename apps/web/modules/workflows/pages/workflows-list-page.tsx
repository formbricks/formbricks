"use client";

import { TFunction } from "i18next";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TWorkflowSortBy, TWorkflowStatus } from "@formbricks/workflows";
import { FORMBRICKS_WORKFLOWS_FILTERS_KEY_LS } from "@/lib/localStorage";
import { timeSince } from "@/lib/time";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import { CardTable, CardTableHeader, CardTableRow } from "@/modules/ui/components/card-table";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { SearchBar } from "@/modules/ui/components/search-bar";
import { Switch } from "@/modules/ui/components/switch";
import {
  type TWorkflowStatusFilterOption,
  WorkflowFilterDropdown,
} from "../components/workflow-filter-dropdown";
import { WorkflowListActions } from "../components/workflow-list-actions";
import { type TWorkflowSortOption, WorkflowSortDropdown } from "../components/workflow-sort-dropdown";
import { WorkflowStatusPill } from "../components/workflow-status-pill";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import { useWorkflows } from "../hooks/use-workflows";
import { computeStatusIn, parseStoredWorkflowFilters } from "../lib/list-filters";
import { WorkflowsListBodyLoading } from "../loading";

interface WorkflowsListPageProps {
  workspaceId: string;
  isReadOnly: boolean;
  workflowsPerPage: number;
}

// Live statuses the status filter exposes. Archived is governed by the Show-archived toggle, so it is
// intentionally excluded here.
const getStatusFilterOptions = (t: TFunction): TWorkflowStatusFilterOption[] => [
  { label: t("common.draft"), value: "draft" },
  { label: t("common.enabled"), value: "enabled" },
  { label: t("common.disabled"), value: "disabled" },
];

const getSortOptions = (t: TFunction): TWorkflowSortOption[] => [
  { label: t("common.updated_at"), value: "updatedAt" },
  { label: t("common.created_at"), value: "createdAt" },
  { label: t("workspace.workflows.alphabetical"), value: "name" },
];

export const WorkflowsListPage = ({
  workspaceId,
  isReadOnly,
  workflowsPerPage,
}: Readonly<WorkflowsListPageProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";

  const [searchValue, setSearchValue] = useState("");
  const debouncedSearchValue = useDebouncedValue(searchValue, 300);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<TWorkflowStatus[]>([]);
  const [sortBy, setSortBy] = useState<TWorkflowSortBy>("updatedAt");
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isFilterInitialized, setIsFilterInitialized] = useState(false);

  const statusIn = useMemo(
    () => computeStatusIn(selectedStatuses, showArchived),
    [selectedStatuses, showArchived]
  );

  // Hydrate the toolbar filters from localStorage once on mount (mirrors the surveys list). Reading
  // happens post-mount because localStorage is unavailable during SSR.
  useEffect(() => {
    if (typeof globalThis.window === "undefined") return;
    const stored = globalThis.window.localStorage.getItem(FORMBRICKS_WORKFLOWS_FILTERS_KEY_LS);
    const parsed = parseStoredWorkflowFilters(stored);
    if (stored && !parsed) {
      globalThis.window.localStorage.removeItem(FORMBRICKS_WORKFLOWS_FILTERS_KEY_LS);
    } else if (parsed) {
      setSearchValue(parsed.searchValue);
      setSelectedStatuses(parsed.selectedStatuses);
      setSortBy(parsed.sortBy);
      setShowArchived(parsed.showArchived);
    }
    setIsFilterInitialized(true);
  }, []);

  // Persist on change, but only after hydration so the empty defaults don't overwrite the stored
  // value before it has been read.
  useEffect(() => {
    if (!isFilterInitialized || typeof globalThis.window === "undefined") return;
    globalThis.window.localStorage.setItem(
      FORMBRICKS_WORKFLOWS_FILTERS_KEY_LS,
      JSON.stringify({ searchValue, selectedStatuses, sortBy, showArchived })
    );
  }, [searchValue, selectedStatuses, sortBy, showArchived, isFilterInitialized]);

  const toggleStatus = (value: TWorkflowStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(value) ? prev.filter((status) => status !== value) : [...prev, value]
    );
  };

  const clearFilters = () => {
    setSelectedStatuses([]);
    setSearchValue("");
  };

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
  } = useWorkflows({
    workspaceId,
    limit: workflowsPerPage,
    nameContains: debouncedSearchValue.trim(),
    statusIn,
    sortBy,
  });

  const showInitialLoading = isLoading && workflows.length === 0;
  const hasSearchTerm = debouncedSearchValue.trim().length > 0;
  const hasActiveFilters = selectedStatuses.length > 0 || searchValue.length > 0;

  let listContent: React.ReactNode;

  if (showInitialLoading) {
    listContent = <WorkflowsListBodyLoading />;
  } else if (isError && workflows.length === 0) {
    listContent = (
      <div className="flex w-full flex-col items-center justify-center gap-4 py-16 text-slate-600">
        <p>{getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"))}</p>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          {t("common.try_again")}
        </Button>
      </div>
    );
  } else if (workflows.length === 0) {
    listContent = (
      <EmptyState
        text={
          hasSearchTerm ? t("common.no_workflows_found") : t("workspace.workflows.no_workflows_description")
        }
      />
    );
  } else {
    listContent = (
      <div>
        <CardTable>
          <CardTableHeader className="grid-cols-7">
            <div className="col-span-2 place-self-start">{t("common.name")}</div>
            <div className="col-span-1">{t("common.status")}</div>
            <div className="col-span-1">{t("common.runs")}</div>
            <div className="col-span-1">{t("common.created_at")}</div>
            <div className="col-span-1">{t("common.updated_at")}</div>
            <div className="col-span-1">{t("common.created_by")}</div>
          </CardTableHeader>

          {workflows.map((workflow) => (
            <CardTableRow
              key={workflow.id}
              href={`/workspaces/${workspaceId}/workflows/${workflow.id}`}
              className="grid-cols-7"
              actions={
                <WorkflowListActions
                  workflowId={workflow.id}
                  workflowName={workflow.name}
                  workspaceId={workspaceId}
                  isReadOnly={isReadOnly}
                  queryKey={queryKey}
                />
              }>
              <div className="col-span-2 flex max-w-full items-center justify-self-start text-sm font-medium text-slate-900">
                <div className="min-w-0 truncate">{workflow.name}</div>
              </div>
              <div className="col-span-1">
                <WorkflowStatusPill status={workflow.status} />
              </div>
              {/* Runs count is hardcoded to 0 until the runs-count API lands (tracked separately). */}
              <div className="col-span-1 text-sm text-slate-600">0</div>
              <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
                {timeSince(workflow.createdAt, locale)}
              </div>
              <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
                {timeSince(workflow.updatedAt, locale)}
              </div>
              <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
                {workflow.creator?.name ?? "-"}
              </div>
            </CardTableRow>
          ))}
        </CardTable>

        {hasNextPage ? (
          <div className="flex justify-center py-5">
            <Button
              onClick={() => fetchNextPage()}
              variant="secondary"
              size="sm"
              loading={isFetchingNextPage}>
              {t("common.load_more")}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-x-2">
          <SearchBar
            value={searchValue}
            onChange={setSearchValue}
            placeholder={t("workspace.workflows.search_by_workflow_name")}
            className="w-80 border-slate-700"
          />
          <WorkflowFilterDropdown
            title={t("common.status")}
            options={getStatusFilterOptions(t)}
            selectedOptions={selectedStatuses}
            onToggleOption={toggleStatus}
            isOpen={isStatusDropdownOpen}
            toggleDropdown={() => setIsStatusDropdownOpen((prev) => !prev)}
          />
          {hasActiveFilters ? (
            <Button size="sm" className="h-8" onClick={clearFilters}>
              {t("common.clear_filters")}
              <X />
            </Button>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
            <label htmlFor="show-archived" className="cursor-pointer text-sm text-slate-500">
              {t("workspace.workflows.show_archived")}
            </label>
          </div>
          <WorkflowSortDropdown options={getSortOptions(t)} sortBy={sortBy} onSortChange={setSortBy} />
        </div>
      </div>
      {listContent}
    </div>
  );
};

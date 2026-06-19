"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { timeSince } from "@/lib/time";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import { CardTable, CardTableHeader, CardTableRow } from "@/modules/ui/components/card-table";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { SearchBar } from "@/modules/ui/components/search-bar";
import { WorkflowListActions } from "../components/workflow-list-actions";
import { WorkflowStatusPill } from "../components/workflow-status-pill";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import { useWorkflows } from "../hooks/use-workflows";
import { WorkflowsListBodyLoading } from "../loading";

interface WorkflowsListPageProps {
  workspaceId: string;
  isReadOnly: boolean;
  workflowsPerPage: number;
}

/**
 * Workflows list body (the persistent header/nav/CTA live in the route group layout). All server
 * communication is TanStack Query: an infinite cursor query owns loading/empty/error/retry and
 * load-more, and name search is server-side (`filter[name][contains]`), debounced so a term change
 * refetches from page 1 instead of filtering already-loaded pages. Archived workflows are excluded
 * by default (the API default-excludes them when no status filter is sent).
 */
export const WorkflowsListPage = ({
  workspaceId,
  isReadOnly,
  workflowsPerPage,
}: Readonly<WorkflowsListPageProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";

  const [searchValue, setSearchValue] = useState("");
  const debouncedSearchValue = useDebouncedValue(searchValue, 300);

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
  });

  const showInitialLoading = isLoading && workflows.length === 0;
  const hasSearchTerm = debouncedSearchValue.trim().length > 0;

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
          <CardTableHeader className="grid-cols-5">
            <div className="col-span-2 place-self-start">{t("common.name")}</div>
            <div className="col-span-1">{t("common.status")}</div>
            <div className="col-span-1">{t("common.created_at")}</div>
            <div className="col-span-1">{t("common.updated_at")}</div>
          </CardTableHeader>

          {workflows.map((workflow) => (
            <CardTableRow
              key={workflow.id}
              href={`/workspaces/${workspaceId}/workflows/${workflow.id}`}
              className="grid-cols-5"
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
                <div className="min-w-0">
                  <div className="truncate">{workflow.name}</div>
                  {workflow.description ? (
                    <div className="mt-1 truncate text-xs font-normal text-slate-500">
                      {workflow.description}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="col-span-1">
                <WorkflowStatusPill status={workflow.status} />
              </div>
              <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
                {timeSince(workflow.createdAt, locale)}
              </div>
              <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
                {timeSince(workflow.updatedAt, locale)}
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
      <div className="flex justify-between">
        <SearchBar
          value={searchValue}
          onChange={setSearchValue}
          placeholder={t("workspace.workflows.search_by_workflow_name")}
          className="border-slate-700"
        />
      </div>
      {listContent}
    </div>
  );
};

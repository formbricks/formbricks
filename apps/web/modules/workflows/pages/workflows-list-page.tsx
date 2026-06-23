"use client";

import { useTranslation } from "react-i18next";
import { timeSince } from "@/lib/time";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Badge } from "@/modules/ui/components/badge";
import { CardTable, CardTableHeader, CardTableRow } from "@/modules/ui/components/card-table";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { WorkflowListActions } from "@/modules/workflows/components/workflow-list-actions";
import { getWorkflowStatusBadge } from "@/modules/workflows/lib/display";
import { useWorkflows } from "@/modules/workflows/list/hooks/use-workflows";

const WORKFLOWS_PER_PAGE = 50;

interface WorkflowsListPageProps {
  workspaceId: string;
}

export const WorkflowsListPage = ({ workspaceId }: Readonly<WorkflowsListPageProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { workflows, isLoading, isError, error } = useWorkflows({
    workspaceId,
    limit: WORKFLOWS_PER_PAGE,
  });

  if (isLoading) {
    return <EmptyState text={t("common.loading")} />;
  }

  if (isError) {
    return <EmptyState text={getV3ApiErrorMessage(error, t("workspace.workflows.load_failed"))} />;
  }

  if (workflows.length === 0) {
    return <EmptyState text={t("common.no_workflows_found")} />;
  }

  return (
    <CardTable>
      <CardTableHeader className="grid-cols-5">
        <div className="col-span-2 place-self-start">{t("common.name")}</div>
        <div className="col-span-1">{t("common.status")}</div>
        <div className="col-span-1">{t("common.created_at")}</div>
        <div className="col-span-1">{t("common.updated_at")}</div>
      </CardTableHeader>

      {workflows.map((workflow) => {
        const statusBadge = getWorkflowStatusBadge(workflow.status, t);

        return (
          <CardTableRow
            key={workflow.id}
            href={`/workspaces/${workspaceId}/workflows/${workflow.id}`}
            className="grid-cols-5"
            actions={<WorkflowListActions workflowId={workflow.id} workspaceId={workspaceId} />}>
            <div className="col-span-2 flex max-w-full items-center justify-self-start text-sm font-medium text-slate-900">
              <div className="w-full truncate">{workflow.name}</div>
            </div>
            <div className="col-span-1">
              <Badge text={statusBadge.label} type={statusBadge.type} size="tiny" />
            </div>
            <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
              {timeSince(workflow.createdAt, locale)}
            </div>
            <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
              {timeSince(workflow.updatedAt, locale)}
            </div>
          </CardTableRow>
        );
      })}
    </CardTable>
  );
};

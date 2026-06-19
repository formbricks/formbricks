"use client";

import { useTranslation } from "react-i18next";
import type { TWorkflowListItem } from "@formbricks/workflows";
import { timeSince } from "@/lib/time";
import { Badge } from "@/modules/ui/components/badge";
import { CardTable, CardTableHeader, CardTableRow } from "@/modules/ui/components/card-table";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { WorkflowListActions } from "@/modules/workflows/components/workflow-list-actions";
import { getWorkflowStatusBadge } from "@/modules/workflows/lib/display";

interface WorkflowsListPageProps {
  workspaceId: string;
  workflows: TWorkflowListItem[];
}

export const WorkflowsListPage = ({ workspaceId, workflows }: Readonly<WorkflowsListPageProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

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

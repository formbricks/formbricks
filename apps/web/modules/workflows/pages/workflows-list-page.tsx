"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { TWorkflowListItem } from "@formbricks/workflows";
import { timeSince } from "@/lib/time";
import { Badge } from "@/modules/ui/components/badge";
import { WorkflowListActions } from "../components/workflow-list-actions";
import { getWorkflowStatusBadge } from "../lib/display";

interface WorkflowsListPageProps {
  workspaceId: string;
  workflows: TWorkflowListItem[];
}

export const WorkflowsListPage = ({ workspaceId, workflows }: Readonly<WorkflowsListPageProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  return (
    <div className="space-y-3">
      <div className="mt-6 grid w-full grid-cols-5 place-items-center gap-3 px-6 pr-8 text-sm text-slate-800">
        <div className="col-span-2 place-self-start">{t("common.name")}</div>
        <div className="col-span-1">{t("common.status")}</div>
        <div className="col-span-1">{t("common.created_at")}</div>
        <div className="col-span-1">{t("common.updated_at")}</div>
      </div>

      {workflows.map((workflow) => {
        const statusBadge = getWorkflowStatusBadge(workflow.status, t);

        return (
          <div key={workflow.id} className="relative block">
            <Link
              href={`/workspaces/${workspaceId}/workflows/${workflow.id}`}
              className="grid w-full grid-cols-5 place-items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 pr-8 shadow-sm transition-colors ease-in-out hover:border-slate-400">
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
            </Link>
            <div className="absolute right-3 top-3.5">
              <WorkflowListActions workflowId={workflow.id} workspaceId={workspaceId} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

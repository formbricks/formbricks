"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { SurveyStatusIndicator } from "@/modules/ui/components/survey-status-indicator";
import { WorkflowListActions } from "../components/workflow-list-actions";
import { placeholderWorkflows } from "../lib/placeholder-data";

interface WorkflowsListPageProps {
  workspaceId: string;
}

export const WorkflowsListPage = ({ workspaceId }: Readonly<WorkflowsListPageProps>) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div className="mt-6 grid w-full grid-cols-8 place-items-center gap-3 px-6 pr-8 text-sm text-slate-800">
        <div className="col-span-2 place-self-start">{t("common.name")}</div>
        <div className="col-span-1">{t("common.status")}</div>
        <div className="col-span-1">{t("common.created_at")}</div>
        <div className="col-span-1">{t("common.updated_at")}</div>
        <div className="col-span-2">{t("common.activity")}</div>
      </div>

      {placeholderWorkflows.map((workflow) => (
        <div key={workflow.id} className="relative block">
          <Link
            href={`/workspaces/${workspaceId}/workflows/${workflow.id}`}
            className="grid w-full grid-cols-8 place-items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 pr-8 shadow-sm transition-colors ease-in-out hover:border-slate-400">
            <div className="col-span-2 flex max-w-full items-center justify-self-start text-sm font-medium text-slate-900">
              <div className="w-full truncate">{workflow.name}</div>
            </div>
            <div
              className={cn(
                "col-span-1 flex w-fit items-center gap-2 whitespace-nowrap rounded-full py-1 pl-1 pr-2 text-sm text-slate-800",
                workflow.status === "inProgress" && "bg-emerald-50",
                workflow.status === "draft" && "bg-slate-100",
                workflow.status === "paused" && "bg-slate-100"
              )}>
              <SurveyStatusIndicator status={workflow.status} /> {workflow.statusLabel}
            </div>
            <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
              {workflow.createdAtLabel}
            </div>
            <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
              {workflow.updatedAtLabel}
            </div>
            <div className="col-span-2 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
              {workflow.activityLabel}
            </div>
          </Link>
          <div className="absolute right-3 top-3.5">
            <WorkflowListActions workflowId={workflow.id} workspaceId={workspaceId} />
          </div>
        </div>
      ))}
    </div>
  );
};

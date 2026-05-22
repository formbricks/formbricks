"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { formatDateTimeForDisplay } from "@/lib/utils/datetime";
import type { TWorkflowRun } from "../types/workflows";
import { WorkflowRunStatusBadge } from "./status-badges";

type TWorkflowRunsTableProps = Readonly<{
  runs: TWorkflowRun[];
  workspaceId: string;
  workflowId?: string;
  showWorkflowColumn?: boolean;
}>;

export const WorkflowRunsTable = ({
  runs,
  workspaceId,
  workflowId,
  showWorkflowColumn = false,
}: TWorkflowRunsTableProps) => {
  const { t, i18n } = useTranslation();
  const runColumnSpan = showWorkflowColumn ? "col-span-2" : "col-span-3";
  const workflowColumn = showWorkflowColumn ? (
    <div className="col-span-2">{t("workspace.workflows.workflow")}</div>
  ) : null;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-12 gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
        <div className={runColumnSpan}>{t("workspace.workflows.run")}</div>
        {workflowColumn}
        <div className="col-span-2">{t("common.status")}</div>
        <div className="col-span-3">{t("common.created_at")}</div>
        <div className="col-span-2">{t("workspace.workflows.response")}</div>
        <div className="col-span-1">{t("workspace.workflows.error")}</div>
      </div>
      {runs.map((run) => {
        const targetWorkflowId = workflowId ?? run.workflow?.id ?? run.workflowId;

        return (
          <Link
            key={run.id}
            href={`/workspaces/${workspaceId}/workflows/${targetWorkflowId}/runs/${run.id}`}
            className="grid grid-cols-12 gap-4 border-b border-slate-100 px-4 py-4 text-sm last:border-b-0 hover:bg-slate-50">
            <div className={`${runColumnSpan} truncate font-medium text-slate-900`}>{run.id}</div>
            {showWorkflowColumn ? (
              <div className="col-span-2 truncate text-slate-600">{run.workflow?.name ?? run.workflowId}</div>
            ) : null}
            <div className="col-span-2">
              <WorkflowRunStatusBadge status={run.status} />
            </div>
            <div className="col-span-3 text-slate-600">
              {formatDateTimeForDisplay(new Date(run.createdAt), i18n.resolvedLanguage)}
            </div>
            <div className="col-span-2 truncate text-slate-600">{run.responseId ?? t("common.none")}</div>
            <div className="col-span-1 truncate text-slate-600">{run.error ?? t("common.none")}</div>
          </Link>
        );
      })}
    </div>
  );
};

import type { TFunction } from "i18next";
import { MoreVerticalIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/modules/ui/components/badge";

const workflowRunRows = [
  {
    description: "Survey response matched the ending-card condition.",
    id: "run_placeholder_completed",
    statusLabel: "Completed",
    statusType: "success",
  },
  {
    description: "Manual dry run from the workflow builder.",
    id: "run_placeholder_dry_run",
    statusLabel: "Dry run",
    statusType: "gray",
  },
  {
    description: "Email provider returned a delivery error.",
    id: "run_placeholder_failed",
    statusLabel: "Failed",
    statusType: "error",
  },
] as const;

interface WorkflowRunsTableProps {
  showWorkflowColumn?: boolean;
  t: TFunction;
  workflowId?: string;
  workspaceId: string;
}

export const WorkflowRunsTable = ({
  showWorkflowColumn = false,
  t,
  workflowId,
  workspaceId,
}: Readonly<WorkflowRunsTableProps>) => {
  const routeWorkflowId = workflowId ?? "response-completed-follow-up";
  const runColumnSpan = showWorkflowColumn ? "col-span-2" : "col-span-3";

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-12 gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500">
        <div className={runColumnSpan}>{t("common.id")}</div>
        {showWorkflowColumn ? <div className="col-span-2">{t("common.workflows")}</div> : null}
        <div className="col-span-2">{t("common.status")}</div>
        <div className="col-span-3">{t("common.created_at")}</div>
        <div className="col-span-2">{t("common.time")}</div>
        <div className="col-span-1" />
      </div>

      {workflowRunRows.map((run) => (
        <Link
          key={run.id}
          href={`/workspaces/${workspaceId}/workflows/${routeWorkflowId}/runs/${run.id}`}
          className="grid grid-cols-12 items-center gap-4 border-b border-slate-100 px-4 py-4 text-sm last:border-b-0 hover:bg-slate-50">
          <div className={`${runColumnSpan} min-w-0`}>
            <p className="truncate font-mono text-slate-900">{run.id}</p>
            <p className="truncate text-slate-500">{run.description}</p>
          </div>
          {showWorkflowColumn ? (
            <div className="col-span-2 truncate text-slate-700">Response follow-up</div>
          ) : null}
          <div className="col-span-2">
            <Badge text={run.statusLabel} type={run.statusType} size="normal" />
          </div>
          <div className="col-span-3 text-slate-600">Not set</div>
          <div className="col-span-2 text-slate-600">Not set</div>
          <div className="col-span-1 flex justify-end text-slate-500">
            <MoreVerticalIcon className="h-4 w-4" aria-hidden="true" />
          </div>
        </Link>
      ))}
    </div>
  );
};

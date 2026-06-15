import type { TFunction } from "i18next";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Badge } from "@/modules/ui/components/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";

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
  const idColumnClassName = showWorkflowColumn ? "w-[30%]" : "w-[44%]";
  const statusColumnClassName = showWorkflowColumn ? "w-[14%]" : "w-[16%]";
  const dateColumnClassName = showWorkflowColumn ? "w-[16%]" : "w-[20%]";
  const timeColumnClassName = showWorkflowColumn ? "w-[16%]" : "w-[20%]";

  return (
    <div
      className="overflow-hidden rounded-lg border border-slate-200 bg-white"
      aria-label="Workflow runs list">
      <Table className="table-fixed">
        <TableHeader role="rowgroup">
          <TableRow className="bg-slate-100" role="row">
            <TableHead className={cn("font-medium text-slate-500", idColumnClassName)}>
              {t("common.id")}
            </TableHead>
            {showWorkflowColumn ? (
              <TableHead className="w-[24%] font-medium text-slate-500">{t("common.workflows")}</TableHead>
            ) : null}
            <TableHead className={cn("font-medium text-slate-500", statusColumnClassName)}>
              {t("common.status")}
            </TableHead>
            <TableHead className={cn("font-medium text-slate-500", dateColumnClassName)}>
              {t("common.created_at")}
            </TableHead>
            <TableHead className={cn("font-medium text-slate-500", timeColumnClassName)}>
              {t("common.time")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workflowRunRows.map((run) => {
            const href = `/workspaces/${workspaceId}/workflows/${routeWorkflowId}/runs/${run.id}`;

            return (
              <TableRow key={run.id}>
                <TableCell className="p-0">
                  <Link href={href} className="block min-w-0 p-4">
                    <p className="truncate font-mono text-sm font-medium text-slate-900">{run.id}</p>
                    <p className="truncate text-sm text-slate-500">{run.description}</p>
                  </Link>
                </TableCell>
                {showWorkflowColumn ? (
                  <TableCell className="p-0">
                    <Link href={href} className="block truncate p-4 text-sm text-slate-700">
                      Response follow-up
                    </Link>
                  </TableCell>
                ) : null}
                <TableCell className="p-0">
                  <Link href={href} className="block p-4">
                    <Badge text={run.statusLabel} type={run.statusType} size="tiny" />
                  </Link>
                </TableCell>
                <TableCell className="p-0">
                  <Link href={href} className="block truncate p-4 text-sm text-slate-600">
                    Not set
                  </Link>
                </TableCell>
                <TableCell className="p-0">
                  <Link href={href} className="block truncate p-4 text-sm text-slate-600">
                    Not set
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

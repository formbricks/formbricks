"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { timeSince } from "@/lib/time";
import { Badge } from "@/modules/ui/components/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { getWorkflowRunStatusBadge, getWorkflowTriggerTypeLabel } from "@/modules/workflows/lib/display";
import { type TWorkflowRunListItem } from "@/modules/workflows/types";
import { WorkflowRunDetailDrawer } from "./workflow-run-detail-drawer";

interface WorkflowRunsTableProps {
  runs: TWorkflowRunListItem[];
  showWorkflowColumn?: boolean;
}

export const WorkflowRunsTable = ({ runs, showWorkflowColumn = false }: Readonly<WorkflowRunsTableProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [selectedRun, setSelectedRun] = useState<TWorkflowRunListItem | null>(null);

  return (
    <>
      <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
        <Table className="w-full" style={{ tableLayout: "fixed" }}>
          <TableHeader>
            <TableRow>
              <TableHead className="h-10 w-[46%] bg-white font-semibold">
                {showWorkflowColumn ? t("common.workflow_name") : t("common.trigger")}
              </TableHead>
              <TableHead className="h-10 w-[18%] bg-white font-semibold">{t("common.status")}</TableHead>
              <TableHead className="h-10 w-[18%] bg-white font-semibold">{t("common.started_at")}</TableHead>
              <TableHead className="h-10 w-[18%] bg-white font-semibold">{t("common.finished_at")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => {
              const statusBadge = getWorkflowRunStatusBadge(run.status, t);
              const triggerLabel = getWorkflowTriggerTypeLabel(run.triggerType, t);

              return (
                <TableRow key={run.id} onClick={() => setSelectedRun(run)} className="cursor-pointer">
                  <TableCell className="min-w-0 px-4 py-2">
                    {showWorkflowColumn ? (
                      <>
                        <p className="truncate text-sm font-medium text-slate-900">{run.workflowName}</p>
                        <p className="truncate text-sm text-slate-500">{triggerLabel}</p>
                      </>
                    ) : (
                      <p className="truncate text-sm text-slate-700">{triggerLabel}</p>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2">
                    <Badge text={statusBadge.label} type={statusBadge.type} size="tiny" />
                  </TableCell>
                  <TableCell className="truncate px-4 py-2 text-sm text-slate-600">
                    {run.startedAt ? timeSince(run.startedAt, locale) : t("common.not_set")}
                  </TableCell>
                  <TableCell className="truncate px-4 py-2 text-sm text-slate-600">
                    {run.finishedAt ? timeSince(run.finishedAt, locale) : t("common.not_set")}
                  </TableCell>
                </TableRow>
              );
            })}
            {runs.length === 0 && (
              <TableRow className="hover:bg-white">
                <TableCell colSpan={4} className="h-24 text-center">
                  <p className="text-slate-400">{t("common.no_results")}</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <WorkflowRunDetailDrawer
        run={selectedRun}
        open={selectedRun !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedRun(null);
          }
        }}
      />
    </>
  );
};

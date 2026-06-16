"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/modules/ui/components/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { type TPlaceholderWorkflowRunListItem } from "../lib/placeholder-data";
import { WorkflowRunDetailDrawer } from "./workflow-run-detail-drawer";

interface WorkflowRunsTableProps {
  runs: TPlaceholderWorkflowRunListItem[];
  showWorkflowColumn?: boolean;
}

export const WorkflowRunsTable = ({ runs, showWorkflowColumn = false }: Readonly<WorkflowRunsTableProps>) => {
  const { t } = useTranslation();
  const [selectedRun, setSelectedRun] = useState<TPlaceholderWorkflowRunListItem | null>(null);

  return (
    <>
      <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
        <Table className="w-full" style={{ tableLayout: "fixed" }}>
          <TableHeader>
            <TableRow>
              <TableHead className="h-10 w-[46%] bg-white font-semibold">
                {showWorkflowColumn ? t("common.workflow_name") : t("common.summary")}
              </TableHead>
              <TableHead className="h-10 w-[18%] bg-white font-semibold">{t("common.status")}</TableHead>
              <TableHead className="h-10 w-[18%] bg-white font-semibold">{t("common.started_at")}</TableHead>
              <TableHead className="h-10 w-[18%] bg-white font-semibold">{t("common.finished_at")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id} onClick={() => setSelectedRun(run)} className="cursor-pointer">
                <TableCell className="min-w-0 px-4 py-2">
                  {showWorkflowColumn ? (
                    <>
                      <p className="truncate text-sm font-medium text-slate-900">{run.workflowName}</p>
                      <p className="truncate text-sm text-slate-500">{run.description}</p>
                    </>
                  ) : (
                    <p className="truncate text-sm text-slate-700">{run.description}</p>
                  )}
                </TableCell>
                <TableCell className="px-4 py-2">
                  <Badge text={run.statusLabel} type={run.statusType} size="tiny" />
                </TableCell>
                <TableCell className="truncate px-4 py-2 text-sm text-slate-600">
                  {run.createdAtLabel}
                </TableCell>
                <TableCell className="truncate px-4 py-2 text-sm text-slate-600">{run.timeLabel}</TableCell>
              </TableRow>
            ))}
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

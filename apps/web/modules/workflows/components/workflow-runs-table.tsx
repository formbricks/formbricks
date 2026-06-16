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
      <div
        className="overflow-hidden rounded-lg border border-slate-200 bg-white"
        aria-label={t("common.workflow_runs")}>
        <Table className="table-fixed">
          <TableHeader role="rowgroup">
            <TableRow className="bg-slate-100" role="row">
              <TableHead className="w-[46%] font-medium text-slate-500">
                {showWorkflowColumn ? t("common.workflow_name") : t("common.summary")}
              </TableHead>
              <TableHead className="w-[18%] font-medium text-slate-500">{t("common.status")}</TableHead>
              <TableHead className="w-[18%] font-medium text-slate-500">{t("common.started_at")}</TableHead>
              <TableHead className="w-[18%] font-medium text-slate-500">{t("common.finished_at")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow
                key={run.id}
                onClick={() => setSelectedRun(run)}
                className="cursor-pointer transition-colors hover:bg-slate-50">
                <TableCell className="min-w-0">
                  {showWorkflowColumn ? (
                    <>
                      <p className="truncate text-sm font-medium text-slate-900">{run.workflowName}</p>
                      <p className="truncate text-sm text-slate-500">{run.description}</p>
                    </>
                  ) : (
                    <p className="truncate text-sm text-slate-700">{run.description}</p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge text={run.statusLabel} type={run.statusType} size="tiny" />
                </TableCell>
                <TableCell className="truncate text-sm text-slate-600">{run.createdAtLabel}</TableCell>
                <TableCell className="truncate text-sm text-slate-600">{run.timeLabel}</TableCell>
              </TableRow>
            ))}
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

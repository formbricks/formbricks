"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { timeSince } from "@/lib/time";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { getWorkflowRunStatusBadge, getWorkflowTriggerTypeLabel } from "@/modules/ee/workflows/lib/display";
import { type TWorkflowRunListItem } from "@/modules/ee/workflows/types";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { RunsTableSkeleton } from "../../loading";
import { WorkflowRunDetailDrawer } from "./workflow-run-detail-drawer";

interface WorkflowRunsTableProps {
  runs: TWorkflowRunListItem[];
  showWorkflowColumn?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  isFetchNextPageError?: boolean;
  onLoadMore?: () => void;
}

export const WorkflowRunsTable = ({
  runs,
  showWorkflowColumn = false,
  isLoading = false,
  isError = false,
  error,
  onRetry,
  hasNextPage = false,
  isFetchingNextPage = false,
  isFetchNextPageError = false,
  onLoadMore,
}: Readonly<WorkflowRunsTableProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? null;

  // Initial fetch with nothing yet to show: render the skeleton instead of an empty table.
  if (isLoading && runs.length === 0) {
    return <RunsTableSkeleton />;
  }

  // Hard error with no rows to fall back on: surface the message and a retry affordance.
  if (isError && runs.length === 0) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4 py-16 text-slate-600">
        <p>{getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"))}</p>
        {onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {t("common.try_again")}
          </Button>
        ) : null}
      </div>
    );
  }

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
                <TableRow
                  key={run.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedRunId(run.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedRunId(run.id);
                    }
                  }}
                  className="cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none">
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

      {hasNextPage ? (
        <div className="flex flex-col items-center gap-2 py-5">
          {/* A failed load-more keeps the already-loaded rows; surface the error inline so it
              isn't swallowed, and let the same button retry the next page. */}
          {isFetchNextPageError ? (
            <p className="text-sm text-red-600">
              {getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"))}
            </p>
          ) : null}
          <Button variant="secondary" size="sm" loading={isFetchingNextPage} onClick={onLoadMore}>
            {t("common.load_more")}
          </Button>
        </div>
      ) : null}

      <WorkflowRunDetailDrawer
        run={selectedRun}
        open={selectedRun !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedRunId(null);
          }
        }}
      />
    </>
  );
};

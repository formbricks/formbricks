"use client";

import { useTranslation } from "react-i18next";
import { getWorkflowRunLogStatusBadge } from "@/modules/ee/workflows/lib/display";
import { type TWorkflowRunLog, formatStepDuration, hasKeys } from "@/modules/ee/workflows/lib/run-display";
import { Badge } from "@/modules/ui/components/badge";
import { RunJsonCode } from "./run-json-code";

interface WorkflowRunStepsProps {
  logs: TWorkflowRunLog[];
}

export const WorkflowRunSteps = ({ logs }: Readonly<WorkflowRunStepsProps>) => {
  const { t } = useTranslation();

  if (logs.length === 0) {
    return <p className="text-sm text-slate-400">{t("common.no_results")}</p>;
  }

  return (
    <ol className="space-y-3">
      {logs.map((log) => {
        const statusBadge = getWorkflowRunLogStatusBadge(log.status, t);
        const duration = formatStepDuration(log.startedAt, log.finishedAt);

        return (
          <li key={log.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                  {log.sequence + 1}
                </span>
                <span className="truncate text-sm font-medium text-slate-900">{log.stepType}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {duration ? <span className="text-xs text-slate-400">{duration}</span> : null}
                <Badge text={statusBadge.label} type={statusBadge.type} size="tiny" />
              </div>
            </div>

            {log.error ? (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{log.error}</p>
            ) : null}

            {hasKeys(log.input) ? (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-slate-500">{t("common.input")}</p>
                <RunJsonCode value={log.input} />
              </div>
            ) : null}

            {hasKeys(log.output) ? (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-slate-500">{t("common.output")}</p>
                <RunJsonCode value={log.output} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
};

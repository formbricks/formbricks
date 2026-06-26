"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/modules/ui/components/badge";
import { CodeBlock } from "@/modules/ui/components/code-block";
import { getWorkflowRunLogStatusBadge } from "@/modules/workflows/lib/display";
import { type TWorkflowRunDetail } from "@/modules/workflows/types";

type TWorkflowRunLog = TWorkflowRunDetail["logs"][number];

// Render a single step's duration as a compact label; null when the step hasn't started/finished.
const formatStepDuration = (startedAt: string | null, finishedAt: string | null): string | null => {
  if (!startedAt || !finishedAt) return null;
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
};

const hasKeys = (value: Record<string, unknown>): boolean => Object.keys(value).length > 0;

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
                <CodeBlock language="json" noMargin>
                  {JSON.stringify(log.input, null, 2)}
                </CodeBlock>
              </div>
            ) : null}

            {hasKeys(log.output) ? (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-slate-500">{t("common.output")}</p>
                <CodeBlock language="json" noMargin>
                  {JSON.stringify(log.output, null, 2)}
                </CodeBlock>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
};

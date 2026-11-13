"use client";

import { useTranslation } from "react-i18next";
import { getWorkflowRunStatusBadge } from "@/modules/ee/workflows/lib/display";
import { type TWorkflowRunSummary } from "@/modules/ee/workflows/types";
import { Badge } from "@/modules/ui/components/badge";

interface RunSummarySectionProps {
  run: TWorkflowRunSummary & { callerIp?: string | null };
  locale: string;
}

const formatStartedAt = (iso: string, locale: string): string =>
  new Date(iso).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

// Status, start, caller and run id (mock screens 7–9). Renders from the list row for an instant
// paint, then from fetched detail (which adds the caller IP) once available.
export const RunSummarySection = ({ run, locale }: Readonly<RunSummarySectionProps>) => {
  const { t } = useTranslation();
  const statusBadge = getWorkflowRunStatusBadge(run.status, t);
  // A Test run is started from the editor; a Webhook run by whoever called the Secret URL.
  const caller = run.isDryRun ? t("workspace.workflows.run_caller_editor_test") : (run.callerIp ?? null);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">{t("common.status")}</span>
        <Badge text={statusBadge.label} type={statusBadge.type} size="tiny" />
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="text-xs text-slate-500">{t("workspace.workflows.run_started")}</dt>
          <dd className="text-xs text-slate-800">
            {run.startedAt ? formatStartedAt(run.startedAt, locale) : t("common.not_set")}
          </dd>
        </div>
        {caller ? (
          <div>
            <dt className="text-xs text-slate-500">{t("workspace.workflows.run_caller")}</dt>
            <dd className="font-mono text-xs break-all text-slate-800">{caller}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs text-slate-500">{t("workspace.workflows.run_id")}</dt>
          <dd className="font-mono text-xs break-all text-slate-800">{run.id}</dd>
        </div>
      </dl>
      {run.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{run.error}</p> : null}
    </section>
  );
};

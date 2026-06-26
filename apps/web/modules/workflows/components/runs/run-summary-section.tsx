"use client";

import { useTranslation } from "react-i18next";
import { timeSince } from "@/lib/time";
import { Badge } from "@/modules/ui/components/badge";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { getWorkflowRunStatusBadge } from "@/modules/workflows/lib/display";
import { type TWorkflowRunListItem } from "@/modules/workflows/types";

interface RunSummarySectionProps {
  run: TWorkflowRunListItem;
  locale: string;
}

// Summary is built entirely from the list row, so it renders instantly without waiting on the detail fetch.
export const RunSummarySection = ({ run, locale }: Readonly<RunSummarySectionProps>) => {
  const { t } = useTranslation();
  const statusBadge = getWorkflowRunStatusBadge(run.status, t);

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{t("common.summary")}</h2>
      <dl className="space-y-4 text-sm">
        <div>
          <dt className="text-slate-500">{t("common.id")}</dt>
          <dd className="mt-1">
            <IdBadge id={run.id} />
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">{t("common.status")}</dt>
          <dd className="mt-1">
            <Badge text={statusBadge.label} type={statusBadge.type} size="normal" />
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">{t("common.started_at")}</dt>
          <dd className="text-slate-900">
            {run.startedAt ? timeSince(run.startedAt, locale) : t("common.not_set")}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">{t("common.finished_at")}</dt>
          <dd className="text-slate-900">
            {run.finishedAt ? timeSince(run.finishedAt, locale) : t("common.not_set")}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">{t("common.attempt")}</dt>
          <dd className="text-slate-900">{run.attempt}</dd>
        </div>
        {run.error ? (
          <div>
            <dt className="text-slate-500">{t("common.error")}</dt>
            <dd className="mt-1 rounded-md bg-red-50 px-3 py-2 text-red-700">{run.error}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
};

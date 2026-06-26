"use client";

import { useTranslation } from "react-i18next";
import { timeSince } from "@/lib/time";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Badge } from "@/modules/ui/components/badge";
import { CodeBlock } from "@/modules/ui/components/code-block";
import { IdBadge } from "@/modules/ui/components/id-badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/modules/ui/components/sheet";
import { Skeleton } from "@/modules/ui/components/skeleton";
import { getWorkflowRunStatusBadge, getWorkflowTriggerTypeLabel } from "@/modules/workflows/lib/display";
import { type TWorkflowRunListItem } from "@/modules/workflows/types";
import { useWorkflowRun } from "../hooks/use-workflow-run";
import { WorkflowRunSteps } from "./workflow-run-steps";

interface WorkflowRunDetailDrawerProps {
  run: TWorkflowRunListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WorkflowRunDetailDrawer = ({
  run,
  open,
  onOpenChange,
}: Readonly<WorkflowRunDetailDrawerProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const statusBadge = run ? getWorkflowRunStatusBadge(run.status, t) : null;

  // The list row gives an instant header + summary; the full run (step logs, trigger payload, run
  // data) is fetched on demand and only while the drawer is open.
  const {
    data: detail,
    isLoading,
    isError,
    error,
  } = useWorkflowRun({ runId: run?.id ?? null, enabled: open });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto bg-white px-5 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{run?.workflowName ?? t("common.workflow_runs")}</SheetTitle>
          <SheetDescription>{run ? getWorkflowTriggerTypeLabel(run.triggerType, t) : null}</SheetDescription>
        </SheetHeader>

        {run && statusBadge ? (
          <div className="space-y-6 py-4">
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

            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">{t("common.steps")}</h2>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              ) : isError ? (
                <p className="text-sm text-slate-600">
                  {getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"))}
                </p>
              ) : detail ? (
                <WorkflowRunSteps logs={detail.logs} />
              ) : null}
            </section>

            {detail ? (
              <>
                <section className="rounded-lg border border-slate-200 bg-white p-5">
                  <h2 className="mb-4 text-lg font-semibold text-slate-900">{t("common.trigger_payload")}</h2>
                  <CodeBlock language="json" noMargin>
                    {JSON.stringify(detail.triggerPayload, null, 2)}
                  </CodeBlock>
                </section>
                <section className="rounded-lg border border-slate-200 bg-white p-5">
                  <h2 className="mb-4 text-lg font-semibold text-slate-900">{t("common.run_data")}</h2>
                  <CodeBlock language="json" noMargin>
                    {JSON.stringify(detail.data, null, 2)}
                  </CodeBlock>
                </section>
              </>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

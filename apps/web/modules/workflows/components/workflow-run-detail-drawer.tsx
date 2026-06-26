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
import { type TWorkflowRunDetail, type TWorkflowRunListItem } from "@/modules/workflows/types";
import { useWorkflowRun } from "../hooks/use-workflow-run";
import { WorkflowRunSteps } from "./workflow-run-steps";

interface WorkflowRunDetailDrawerProps {
  run: TWorkflowRunListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const sectionClass = "rounded-lg border border-slate-200 bg-white p-5";
const headingClass = "mb-4 text-lg font-semibold text-slate-900";

// Summary is built entirely from the list row, so it renders instantly without waiting on the detail fetch.
const RunSummarySection = ({ run, locale }: { run: TWorkflowRunListItem; locale: string }) => {
  const { t } = useTranslation();
  const statusBadge = getWorkflowRunStatusBadge(run.status, t);

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
      <h2 className={headingClass}>{t("common.summary")}</h2>
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

// Step logs section body: one early return per fetch state keeps this flat (no nested ternary).
const RunStepsBody = ({
  isLoading,
  isError,
  error,
  detail,
}: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  detail?: TWorkflowRunDetail;
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-slate-600">
        {getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"))}
      </p>
    );
  }

  if (detail) {
    return <WorkflowRunSteps logs={detail.logs} />;
  }

  return null;
};

const RunJsonSection = ({ title, value }: { title: string; value: unknown }) => (
  <section className={sectionClass}>
    <h2 className={headingClass}>{title}</h2>
    <CodeBlock language="json" noMargin>
      {JSON.stringify(value, null, 2)}
    </CodeBlock>
  </section>
);

export const WorkflowRunDetailDrawer = ({
  run,
  open,
  onOpenChange,
}: Readonly<WorkflowRunDetailDrawerProps>) => {
  const { t, i18n } = useTranslation();

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

        {run ? (
          <div className="space-y-6 py-4">
            <RunSummarySection run={run} locale={i18n.language} />

            <section className={sectionClass}>
              <h2 className={headingClass}>{t("common.steps")}</h2>
              <RunStepsBody isLoading={isLoading} isError={isError} error={error} detail={detail} />
            </section>

            {detail ? (
              <>
                <RunJsonSection title={t("common.trigger_payload")} value={detail.triggerPayload} />
                <RunJsonSection title={t("common.run_data")} value={detail.data} />
              </>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

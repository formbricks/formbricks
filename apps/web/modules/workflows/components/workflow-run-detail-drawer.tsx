"use client";

import { useTranslation } from "react-i18next";
import { timeSince } from "@/lib/time";
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
import { getWorkflowRunStatusBadge, getWorkflowTriggerTypeLabel } from "../lib/display";
import { type TWorkflowRunListItem } from "../types";

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
              </dl>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">{t("common.metadata")}</h2>
              <CodeBlock language="json" noMargin>
                {JSON.stringify(
                  {
                    isDryRun: run.isDryRun,
                    triggerType: run.triggerType,
                    surveyId: run.surveyId,
                    responseId: run.responseId,
                    attempt: run.attempt,
                    error: run.error,
                    workflowVersionId: run.workflowVersionId,
                  },
                  null,
                  2
                )}
              </CodeBlock>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">{t("common.activity")}</h2>
              <CodeBlock language="json" noMargin>
                {JSON.stringify(run.logs, null, 2)}
              </CodeBlock>
            </section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

"use client";

import { SquareArrowOutUpRight } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/modules/ui/components/sheet";
import { getWorkflowTriggerTypeLabel } from "@/modules/workflows/lib/display";
import { type TWorkflowRunListItem } from "@/modules/workflows/types";
import { useWorkflowRun } from "../../hooks/use-workflow-run";
import { RunJsonSection } from "./run-json-section";
import { RunStepsBody } from "./run-steps-body";
import { RunSummarySection } from "./run-summary-section";

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
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";

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
          {run ? (
            <Button asChild variant="link" className="mt-2 h-auto w-fit justify-start p-0 text-sm">
              <Link href={`/workspaces/${run.workspaceId}/workflows/${run.workflowId}`}>
                <SquareArrowOutUpRight />
                {t("common.view_workflow")}
              </Link>
            </Button>
          ) : null}
        </SheetHeader>

        {run ? (
          <div className="space-y-6 py-4">
            {/* Prefer fetched detail once loaded so the summary can't show stale list values while
                the step timeline below shows fresh data; fall back to the list row before it resolves. */}
            <RunSummarySection run={detail ?? run} locale={locale} />

            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">{t("common.steps")}</h2>
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

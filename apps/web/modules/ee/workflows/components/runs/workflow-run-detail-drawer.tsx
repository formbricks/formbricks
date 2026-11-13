"use client";

import { useQuery } from "@tanstack/react-query";
import { InfoIcon, SquareArrowOutUpRight } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { getWorkflow } from "@/modules/ee/workflows/lib/api-client";
import { workflowKeys } from "@/modules/ee/workflows/lib/query";
import { type TWorkflowRunListItem } from "@/modules/ee/workflows/types";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Sheet, SheetContent } from "@/modules/ui/components/sheet";
import { useWorkflowRun } from "../../hooks/use-workflow-run";
import { RunDetailHeader } from "./run-detail-header";
import { RunStepsBody } from "./run-steps-body";
import { RunSummarySection } from "./run-summary-section";

interface WorkflowRunDetailDrawerProps {
  run: TWorkflowRunListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The info line a Test run carries in run detail (mock screen 7). */
export const TestRunNotice = () => {
  const { t } = useTranslation();
  return (
    <Alert variant="info" size="small">
      <InfoIcon />
      <AlertDescription>{t("workspace.workflows.run_test_run_notice")}</AlertDescription>
    </Alert>
  );
};

export const WorkflowRunDetailDrawer = ({
  run,
  open,
  onOpenChange,
}: Readonly<WorkflowRunDetailDrawerProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";

  // The list row gives an instant header + summary; the full run (steps, trigger payload) is
  // fetched on demand and only while the drawer is open.
  const {
    data: detail,
    isLoading,
    isError,
    error,
  } = useWorkflowRun({ runId: run?.id ?? null, enabled: open });

  // Step labels and condition texts come from the workflow's definition. Without it the steps
  // still render, by type and position.
  const { data: workflow } = useQuery({
    queryKey: workflowKeys.detail(run?.workflowId ?? ""),
    queryFn: ({ signal }) => getWorkflow(run?.workflowId ?? "", signal),
    enabled: open && run !== null,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto bg-white px-5 sm:max-w-2xl">
        <RunDetailHeader
          workflowName={run?.workflowName ?? null}
          isDryRun={run?.isDryRun ?? false}
          triggerType={run?.triggerType ?? null}
          versionNumber={detail?.workflowVersionNumber ?? null}>
          {run ? (
            <Button asChild variant="link" className="mt-2 h-auto w-fit justify-start p-0 text-sm">
              <Link href={`/workspaces/${run.workspaceId}/workflows/${run.workflowId}`}>
                <SquareArrowOutUpRight />
                {t("common.view_workflow")}
              </Link>
            </Button>
          ) : null}
        </RunDetailHeader>

        {run ? (
          <div className="space-y-4 py-4">
            {/* Prefer fetched detail once loaded so the summary can't show stale list values while
                the steps below show fresh data; fall back to the list row before it resolves. */}
            <RunSummarySection run={detail ?? run} locale={locale} />
            {run.isDryRun ? <TestRunNotice /> : null}
            <RunStepsBody
              isLoading={isLoading}
              isError={isError}
              error={error}
              detail={detail}
              definition={workflow?.definition ?? null}
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

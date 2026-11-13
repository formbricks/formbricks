"use client";

import type { TFunction } from "i18next";
import { useAtomValue } from "jotai";
import { PlayIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { WEBHOOK_PAYLOAD_MAX_BYTES } from "@formbricks/workflows";
import { useWorkflowRun } from "@/modules/ee/workflows/hooks/use-workflow-run";
import type { TWorkflowTestRunFailure } from "@/modules/ee/workflows/hooks/use-workflow-test-run";
import { getWorkflowApiErrorMessage } from "@/modules/ee/workflows/lib/api-error";
import { workflowAtom, workflowDefinitionAtom } from "@/modules/ee/workflows/state/editor";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Sheet, SheetContent } from "@/modules/ui/components/sheet";
import { Skeleton } from "@/modules/ui/components/skeleton";
import { RunDetailHeader } from "./run-detail-header";
import { RunStepsBody } from "./run-steps-body";
import { RunSummarySection } from "./run-summary-section";
import { TestRunNotice } from "./workflow-run-detail-drawer";

// Literal `t()` calls per failure so the translation scanner sees every key.
const describeFailure = (failure: TWorkflowTestRunFailure, error: unknown, t: TFunction): string => {
  switch (failure) {
    case "not_webhook":
      return t("workspace.workflows.test_run_failed_not_webhook");
    case "archived":
      return t("workspace.workflows.test_run_failed_archived");
    case "no_payload":
      return t("workspace.workflows.test_run_failed_no_payload");
    case "invalid_payload":
      return t("workspace.workflows.test_run_failed_invalid_payload");
    case "payload_too_large":
      return t("workspace.workflows.test_run_failed_payload_too_large", {
        size: WEBHOOK_PAYLOAD_MAX_BYTES / 1024,
      });
    case "not_executable":
      return t("workspace.workflows.test_run_failed_not_executable");
    case "unsaved":
      return t("workspace.workflows.test_run_failed_unsaved");
    case "other":
      return getWorkflowApiErrorMessage(error, t("workspace.workflows.test_run_failed"));
  }
  const exhaustiveCheck: never = failure;
  return exhaustiveCheck;
};

interface WorkflowTestRunDrawerProps {
  open: boolean;
  onClose: () => void;
  onRunAgain: () => void;
  runId: string | null;
  isRunning: boolean;
  failure: TWorkflowTestRunFailure | null;
  error: unknown;
}

/**
 * A Test run's result in the editor (ED6, mock screen 7): today's run drawer, with the Test badge,
 * non-modal so the canvas stays visible and marks the branch the run took. Refusals are explained
 * here, where the result would have been, instead of in a toast.
 */
export const WorkflowTestRunDrawer = ({
  open,
  onClose,
  onRunAgain,
  runId,
  isRunning,
  failure,
  error,
}: Readonly<WorkflowTestRunDrawerProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const workflow = useAtomValue(workflowAtom);
  const definition = useAtomValue(workflowDefinitionAtom);
  // Seeded by the Test run's own answer, so this reads the cache rather than fetching again.
  const { data: run, isLoading, isError, error: loadError } = useWorkflowRun({ runId, enabled: open });

  return (
    <Sheet
      open={open}
      modal={false}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}>
      <SheetContent
        className="w-full overflow-y-auto border-l border-slate-200 bg-white px-5 shadow-xl sm:max-w-lg"
        // Non-modal: working on the canvas keeps the result open; Escape or the close button ends it.
        onInteractOutside={(event) => event.preventDefault()}>
        <RunDetailHeader
          workflowName={workflow?.name ?? null}
          isDryRun
          triggerType={definition?.trigger?.triggerType ?? null}
          versionNumber={null}>
          {/* The drawer covers the header's Test run button while open, so it offers its own. */}
          <Button
            variant="secondary"
            size="sm"
            className="mt-2 w-fit"
            loading={isRunning}
            disabled={isRunning}
            onClick={onRunAgain}>
            <PlayIcon />
            {t("workspace.workflows.test_run_again")}
          </Button>
        </RunDetailHeader>
        <div className="space-y-4 py-4">
          {failure ? (
            <Alert variant="error">
              <AlertTitle>{t("workspace.workflows.test_run_failed_title")}</AlertTitle>
              <AlertDescription>{describeFailure(failure, error, t)}</AlertDescription>
            </Alert>
          ) : null}
          {!failure && (isRunning || (runId === null && !run)) ? (
            <div className="space-y-3" aria-busy="true">
              <p className="text-sm text-slate-600">{t("workspace.workflows.test_run_running")}</p>
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : null}
          {!failure && run ? (
            <>
              <RunSummarySection run={run} locale={locale} />
              <TestRunNotice />
              <RunStepsBody
                isLoading={isLoading}
                isError={isError}
                error={loadError}
                detail={run}
                definition={definition}
              />
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
};

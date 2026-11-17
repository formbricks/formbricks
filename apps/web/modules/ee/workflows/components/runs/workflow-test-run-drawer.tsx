"use client";

import type { TFunction } from "i18next";
import { useAtomValue } from "jotai";
import { PlayIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { WEBHOOK_PAYLOAD_MAX_BYTES, isResponseCompletedTrigger } from "@formbricks/workflows";
import { useStoredTestPayload } from "@/modules/ee/workflows/hooks/use-stored-test-payload";
import { useWorkflowRun } from "@/modules/ee/workflows/hooks/use-workflow-run";
import type { TWorkflowTestRunFailure } from "@/modules/ee/workflows/hooks/use-workflow-test-run";
import { useWorkflowWebhook } from "@/modules/ee/workflows/hooks/use-workflow-webhook";
import { getWorkflowApiErrorMessage } from "@/modules/ee/workflows/lib/api-error";
import { TEST_RUN_DRAWER_ATTRIBUTE } from "@/modules/ee/workflows/lib/canvas-fit";
import { getTestRunDrawerPayload } from "@/modules/ee/workflows/lib/test-run";
import { hasSavedWebhookTrigger } from "@/modules/ee/workflows/lib/workflow-samples";
import { workflowAtom, workflowDefinitionAtom } from "@/modules/ee/workflows/state/editor";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Sheet, SheetContent } from "@/modules/ui/components/sheet";
import { Skeleton } from "@/modules/ui/components/skeleton";
import { RunDetailHeader } from "./run-detail-header";
import { RunStepsBody } from "./run-steps-body";
import { RunSummarySection } from "./run-summary-section";
import { TestRunPayloadEditor } from "./test-run-payload-editor";
import { useTestRunResponsePicker } from "./test-run-response-picker";
import { TestRunNotice } from "./workflow-run-detail-drawer";

// Literal `t()` calls per failure so the translation scanner sees every key.
const describeFailure = (failure: TWorkflowTestRunFailure, error: unknown, t: TFunction): string => {
  switch (failure) {
    case "no_trigger":
      return t("workspace.workflows.test_run_failed_no_trigger");
    case "response_unavailable":
      return t("workspace.workflows.test_run_failed_response_unavailable");
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

/** The drawer's own run button: it covers the header's Test run button while open. */
const TestRunAgainButton = ({
  isRunning,
  isPickingResponse,
  canRun,
  isPayloadInvalid,
  onClick,
}: Readonly<{
  isRunning: boolean;
  isPickingResponse: boolean;
  canRun: boolean;
  isPayloadInvalid: boolean;
  onClick: () => void;
}>) => {
  const { t } = useTranslation();
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        className="mt-2 w-fit"
        loading={isRunning}
        disabled={isRunning || !canRun}
        onClick={onClick}>
        <PlayIcon />
        {isPickingResponse
          ? t("workspace.workflows.test_run_start")
          : t("workspace.workflows.test_run_again")}
      </Button>
      {isPayloadInvalid ? (
        <p className="mt-1 text-xs text-error">{t("workspace.workflows.test_run_payload_invalid")}</p>
      ) : null}
    </>
  );
};

/** The run in progress, before its result comes back. */
const TestRunRunning = ({ withResponse }: Readonly<{ withResponse: boolean }>) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-3" aria-busy="true">
      <p className="text-sm text-slate-600">
        {withResponse
          ? t("workspace.workflows.test_run_running_response")
          : t("workspace.workflows.test_run_running")}
      </p>
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  );
};

interface WorkflowTestRunDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Runs the draft again; a Response completed workflow passes the response picked here. */
  onRunAgain: (responseId?: string) => void;
  runId: string | null;
  isRunning: boolean;
  /** A Response completed workflow is saved and waits for a response to be picked. */
  isPickingResponse: boolean;
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
  isPickingResponse,
  failure,
  error,
}: Readonly<WorkflowTestRunDrawerProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const workflow = useAtomValue(workflowAtom);
  const definition = useAtomValue(workflowDefinitionAtom);
  // Seeded by the Test run's own answer, so this reads the cache rather than fetching again.
  const { data: run, isLoading, isError, error: loadError } = useWorkflowRun({ runId, enabled: open });

  // The Webhook step's payload is the test payload itself, editable here as in the Webhook trigger
  // panel the drawer covers: the same text, kept in this browser, and what Run again sends.
  const [storedPayload, setStoredPayload] = useStoredTestPayload(workflow?.id ?? "");
  const webhook = useWorkflowWebhook({
    workflowId: workflow?.id ?? null,
    enabled: open && hasSavedWebhookTrigger(workflow),
  });
  const runPayload = run?.triggerPayload.type === "webhook" ? run.triggerPayload.payload : null;
  // The last received payload; until the webhook loads, the run's own payload, which is the same one
  // unless an edit was sent (and then the edit is what shows).
  const receivedPayload = webhook.data ? (webhook.data.sample?.payload ?? null) : runPayload;
  const testPayload = getTestRunDrawerPayload({ stored: storedPayload, sample: receivedPayload });
  const payloadEditor = (
    <TestRunPayloadEditor
      text={testPayload.text}
      source={testPayload.source}
      canReset={testPayload.canReset}
      onChange={setStoredPayload}
      onReset={() => setStoredPayload(null)}
    />
  );
  // A refusal about the payload has no run to show it in: offer the editor under the explanation.
  const isPayloadFailure =
    failure === "invalid_payload" || failure === "payload_too_large" || failure === "no_payload";

  // A Response completed workflow tests with one of its survey's responses, picked here in place of
  // the payload editor.
  const responseTrigger = isResponseCompletedTrigger(definition?.trigger) ? definition.trigger : null;
  const { picker: responsePicker, selectedResponseId } = useTestRunResponsePicker({
    open,
    workflowId: workflow?.id ?? null,
    trigger: responseTrigger,
    locale,
  });
  const canRun = responseTrigger ? selectedResponseId !== null : testPayload.canRunAgain;
  const runAgain = () => (responseTrigger ? onRunAgain(selectedResponseId ?? undefined) : onRunAgain());
  // Waiting for a pick, or refused over the picked response: the picker is all there is to show.
  const showsPickerAlone =
    responseTrigger !== null && !isRunning && (isPickingResponse || failure === "response_unavailable");

  return (
    <Sheet
      open={open}
      modal={false}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}>
      <SheetContent
        // The canvas measures this panel to fit the flow into the part the drawer leaves visible.
        {...{ [TEST_RUN_DRAWER_ATTRIBUTE]: "" }}
        className="w-full overflow-y-auto border-l border-slate-200 bg-white px-5 shadow-xl sm:max-w-lg"
        // Non-modal: working on the canvas keeps the result open; Escape or the close button ends it.
        onInteractOutside={(event) => event.preventDefault()}>
        <RunDetailHeader
          workflowName={workflow?.name ?? null}
          isDryRun
          triggerType={definition?.trigger?.triggerType ?? null}
          versionNumber={null}>
          {/* The drawer covers the header's Test run button while open, so it offers its own. */}
          <TestRunAgainButton
            isRunning={isRunning}
            isPickingResponse={isPickingResponse}
            canRun={canRun}
            isPayloadInvalid={!responseTrigger && !testPayload.canRunAgain}
            onClick={runAgain}
          />
        </RunDetailHeader>
        <div className="space-y-4 py-4">
          {failure ? (
            <Alert variant="error">
              <AlertTitle>{t("workspace.workflows.test_run_failed_title")}</AlertTitle>
              <AlertDescription>{describeFailure(failure, error, t)}</AlertDescription>
            </Alert>
          ) : null}
          {isPayloadFailure && !isRunning ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-slate-800">{t("workspace.workflows.test_payload")}</h3>
              {payloadEditor}
            </section>
          ) : null}
          {showsPickerAlone ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-slate-800">{t("workspace.workflows.test_response")}</h3>
              <p className="text-xs text-slate-500">{t("workspace.workflows.test_response_description")}</p>
              {responsePicker}
            </section>
          ) : null}
          {!failure && !showsPickerAlone && (isRunning || (runId === null && !run)) ? (
            <TestRunRunning withResponse={responseTrigger !== null} />
          ) : null}
          {!failure && !showsPickerAlone && run ? (
            <>
              <RunSummarySection run={run} locale={locale} />
              <TestRunNotice />
              <RunStepsBody
                isLoading={isLoading}
                isError={isError}
                error={loadError}
                detail={run}
                definition={definition}
                triggerPayloadEditor={responsePicker ?? payloadEditor}
              />
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
};

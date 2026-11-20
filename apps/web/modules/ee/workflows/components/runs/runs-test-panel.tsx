"use client";

import type { TFunction } from "i18next";
import { useAtomValue, useSetAtom } from "jotai";
import { FlaskConicalIcon, HistoryIcon, PlayIcon, XIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  type TWorkflowResponseCompletedTriggerNode,
  type TWorkflowRunListItem,
  WEBHOOK_PAYLOAD_MAX_BYTES,
} from "@formbricks/workflows";
import { cn } from "@/lib/cn";
import { WorkflowAlert } from "@/modules/ee/workflows/components/workflow-alert";
import {
  WorkflowPanelCollapseButton,
  WorkflowPanelPill,
} from "@/modules/ee/workflows/components/workflow-side-panel";
import { useStoredTestPayload } from "@/modules/ee/workflows/hooks/use-stored-test-payload";
import { useWorkflowWebhook } from "@/modules/ee/workflows/hooks/use-workflow-webhook";
import { getWorkflowApiErrorMessage } from "@/modules/ee/workflows/lib/api-error";
import { getWorkflowRunStatusBadge } from "@/modules/ee/workflows/lib/display";
import { type TRunsViewKind, formatRunTime } from "@/modules/ee/workflows/lib/runs-view";
import { getTestRunDrawerPayload } from "@/modules/ee/workflows/lib/test-run";
import {
  type TWorkflowTestRunFailure,
  closeTestFormAtom,
  isTestFormShownAtom,
  testFormFocusRequestAtom,
} from "@/modules/ee/workflows/state/test-run";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { Skeleton } from "@/modules/ui/components/skeleton";
import { TestRunPayloadEditor } from "./test-run-payload-editor";
import { useTestRunResponsePicker } from "./test-run-response-picker";

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

/** The Webhook workflow's test input: the payload a Test run sends, kept in this browser. */
const WebhookTestInput = ({
  workflowId,
  hasSavedTrigger,
  runButton,
}: Readonly<{ workflowId: string; hasSavedTrigger: boolean; runButton: ReactNode }>) => {
  const [storedPayload, setStoredPayload] = useStoredTestPayload(workflowId);
  const webhook = useWorkflowWebhook({ workflowId, enabled: hasSavedTrigger });
  const testPayload = getTestRunDrawerPayload({
    stored: storedPayload,
    sample: webhook.data?.sample?.payload ?? null,
  });
  return (
    <TestRunPayloadEditor
      text={testPayload.text}
      source={testPayload.source}
      canReset={testPayload.canReset}
      onChange={setStoredPayload}
      onReset={() => setStoredPayload(null)}
      runButton={runButton}
    />
  );
};

// `focusVisible` (Chrome, Edge, Firefox, Safari 18.4+) isn't in every DOM typing yet.
const SHOW_FOCUS_RING: FocusOptions & { focusVisible?: boolean } = { focusVisible: true };

interface RunsTestPanelProps {
  workflowId: string;
  locale: string;
  onCollapsedChange: (isCollapsed: boolean) => void;
  /** Null while the draft loads; a Webhook workflow's test input otherwise. */
  triggerKind: "webhook" | "response" | "none" | null;
  responseTrigger: TWorkflowResponseCompletedTriggerNode | null;
  hasSavedWebhookTrigger: boolean;
  canTest: boolean;
  testRun: {
    isRunning: boolean;
    isPickingResponse: boolean;
    failure: TWorkflowTestRunFailure | null;
    error: unknown;
    startTestRun: (responseId?: string) => Promise<void>;
  };
  kind: TRunsViewKind;
  onKindChange: (kind: TRunsViewKind) => void;
  runs: TWorkflowRunListItem[];
  isLoadingRuns: boolean;
  hasMoreRuns: boolean;
  isLoadingMoreRuns: boolean;
  onLoadMoreRuns: () => void;
  shownRunId: string | null;
  onShowRun: (runId: string) => void;
}

type TTestRunControls = RunsTestPanelProps["testRun"];

/** A refusal about the test input itself: the input opens to fix it. */
/**
 * "Test the draft": the test input (the payload, or the response to test with), "Reset" and "Run
 * test", and why a run didn't start. The header's Test focuses "Run test" when it opens the card.
 */
const TestDraftCard = ({
  workflowId,
  locale,
  triggerKind,
  responseTrigger,
  hasSavedWebhookTrigger,
  testRun,
  onClose,
}: Readonly<{
  workflowId: string;
  locale: string;
  triggerKind: RunsTestPanelProps["triggerKind"];
  responseTrigger: TWorkflowResponseCompletedTriggerNode | null;
  hasSavedWebhookTrigger: boolean;
  testRun: TTestRunControls;
  onClose: () => void;
}>) => {
  const { t } = useTranslation();
  const focusRequest = useAtomValue(testFormFocusRequestAtom);
  const runTestRef = useRef<HTMLButtonElement>(null);
  const { picker: responsePicker, selectedResponseId } = useTestRunResponsePicker({
    open: true,
    workflowId,
    trigger: responseTrigger,
    locale,
  });
  const isResponseTrigger = triggerKind === "response";
  const canStart = !testRun.isRunning && (!isResponseTrigger || selectedResponseId !== null);

  // The header's Test asked for the card: once it shows, "Run test" takes the focus, with its focus
  // ring. A focus moved by script after a mouse click isn't `:focus-visible` unless asked for.
  useEffect(() => {
    if (focusRequest === 0) return;
    const handle = requestAnimationFrame(() => runTestRef.current?.focus(SHOW_FOCUS_RING));
    return () => cancelAnimationFrame(handle);
  }, [focusRequest]);

  const runTestButton = (
    <Button
      ref={runTestRef}
      size="sm"
      loading={testRun.isRunning}
      disabled={!canStart}
      onClick={() => void testRun.startTestRun(selectedResponseId ?? undefined)}>
      <PlayIcon />
      {t("workspace.workflows.runs_run_test")}
    </Button>
  );

  return (
    <section
      aria-label={t("workspace.workflows.runs_test_the_draft")}
      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
          <FlaskConicalIcon className="size-4 text-slate-500" aria-hidden="true" />
          {t("workspace.workflows.runs_test_the_draft")}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="-my-1 size-7 text-slate-500"
          aria-label={t("common.close")}
          onClick={onClose}>
          <XIcon />
        </Button>
      </div>
      {triggerKind === "webhook" ? (
        <WebhookTestInput
          workflowId={workflowId}
          hasSavedTrigger={hasSavedWebhookTrigger}
          runButton={runTestButton}
        />
      ) : null}
      {isResponseTrigger && testRun.isPickingResponse ? (
        <p className="text-xs text-slate-600">{t("workspace.workflows.runs_pick_response")}</p>
      ) : null}
      {isResponseTrigger ? (
        <>
          {responsePicker}
          <div className="flex justify-end">{runTestButton}</div>
        </>
      ) : null}
      {testRun.failure ? (
        <WorkflowAlert variant="error">{describeFailure(testRun.failure, testRun.error, t)}</WorkflowAlert>
      ) : null}
    </section>
  );
};

/** The workflow's runs, newest first, filtered to all, live or Test runs. */
const RunsListSection = (props: Readonly<RunsTestPanelProps>) => {
  const { t } = useTranslation();
  const kinds = [
    ["all", t("common.all")],
    ["live", t("workspace.workflows.runs_filter_live")],
    ["test", t("workspace.workflows.runs_filter_test_runs")],
  ] as const;
  return (
    <section className="flex min-h-0 flex-col gap-2">
      <fieldset className="m-0 grid grid-cols-3 gap-0.5 rounded-md border-0 bg-slate-100 p-0.5">
        <legend className="sr-only">{t("workspace.workflows.runs_filter")}</legend>
        {kinds.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={props.kind === value}
            onClick={() => props.onKindChange(value)}
            className={cn(
              "rounded px-2 py-1 text-xs text-slate-600 hover:text-slate-900",
              props.kind === value && "bg-white font-medium text-slate-900 shadow-sm"
            )}>
            {label}
          </button>
        ))}
      </fieldset>
      {props.isLoadingRuns ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      ) : null}
      {!props.isLoadingRuns && props.runs.length === 0 ? (
        <p className="text-xs text-slate-500">{t("workspace.workflows.runs_none_yet")}</p>
      ) : null}
      <ul className="flex flex-col gap-1" data-testid="workflow-run-list">
        {props.runs.map((run) => (
          <li key={run.id}>
            <RunListRow
              run={run}
              locale={props.locale}
              isShown={run.id === props.shownRunId}
              onShow={props.onShowRun}
            />
          </li>
        ))}
      </ul>
      {props.hasMoreRuns ? (
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          loading={props.isLoadingMoreRuns}
          onClick={props.onLoadMoreRuns}>
          {t("common.load_more")}
        </Button>
      ) : null}
    </section>
  );
};

/**
 * The Runs view's left panel (review point 1), named like its tab: the "Test the draft" card, which
 * the page header's Test shows or hides, above the runs, live and Test, to click through while the
 * canvas stays. Collapsed, it is a pill on the canvas (RunsListPill).
 */
export const RunsTestPanel = (props: Readonly<RunsTestPanelProps>) => {
  const { t } = useTranslation();
  const isFormShown = useAtomValue(isTestFormShownAtom);
  const closeTestForm = useSetAtom(closeTestFormAtom);
  return (
    <aside className="flex min-h-0 w-[320px] shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 py-2 pr-2 pl-4">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{t("common.runs")}</h2>
        <WorkflowPanelCollapseButton side="left" onCollapse={() => props.onCollapsedChange(true)} />
      </header>
      <div className="scroll-bar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {props.canTest && isFormShown ? (
          <TestDraftCard
            workflowId={props.workflowId}
            locale={props.locale}
            triggerKind={props.triggerKind}
            responseTrigger={props.responseTrigger}
            hasSavedWebhookTrigger={props.hasSavedWebhookTrigger}
            testRun={props.testRun}
            onClose={closeTestForm}
          />
        ) : null}
        <RunsListSection {...props} />
      </div>
    </aside>
  );
};

const RunListRow = ({
  run,
  locale,
  isShown,
  onShow,
}: Readonly<{
  run: TWorkflowRunListItem;
  locale: string;
  isShown: boolean;
  onShow: (runId: string) => void;
}>) => {
  const { t } = useTranslation();
  const status = getWorkflowRunStatusBadge(run.status, t);
  return (
    <button
      type="button"
      onClick={() => onShow(run.id)}
      aria-current={isShown}
      className={cn(
        "grid w-full grid-cols-[8px_1fr_auto] items-center gap-x-2.5 gap-y-0.5 rounded-md border border-transparent px-2.5 py-2 text-left hover:bg-slate-50",
        isShown && "border-teal-200 bg-teal-50/60 hover:bg-teal-50/60"
      )}>
      <span
        className={cn("size-2 rounded-full", run.status === "failed" ? "bg-red-500" : "bg-emerald-500")}
        aria-hidden="true"
      />
      <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-slate-800">
        <span className="truncate">{status.label}</span>
        {run.isDryRun ? (
          <Badge text={t("workspace.workflows.run_test_badge")} type="gray" size="tiny" />
        ) : null}
      </span>
      <time className="text-xs text-slate-500" dateTime={run.createdAt}>
        {formatRunTime(run.createdAt, locale)}
      </time>
      {run.error ? (
        <span className="col-start-2 col-end-4 truncate text-xs text-red-600">{run.error}</span>
      ) : null}
    </button>
  );
};

/** The collapsed left panel: a pill at the run canvas's top-left, "Runs" with the shown run's result. */
export const RunsListPill = ({
  shownRun,
  onExpand,
}: Readonly<{ shownRun: TWorkflowRunListItem | null; onExpand: () => void }>) => {
  const { t } = useTranslation();
  let status: "success" | "error" | undefined;
  if (shownRun) status = shownRun.status === "failed" ? "error" : "success";
  return (
    <WorkflowPanelPill
      side="left"
      icon={
        <span className="flex size-7 items-center justify-center rounded-md bg-slate-100 text-slate-600">
          <HistoryIcon className="size-4" aria-hidden="true" />
        </span>
      }
      label={t("common.runs")}
      status={status}
      onExpand={onExpand}
    />
  );
};

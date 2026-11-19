"use client";

import type { TFunction } from "i18next";
import { FlaskConicalIcon, HistoryIcon, PlayIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  type TWorkflowResponseCompletedTriggerNode,
  type TWorkflowRunListItem,
  WEBHOOK_PAYLOAD_MAX_BYTES,
} from "@formbricks/workflows";
import { cn } from "@/lib/cn";
import { formatDateTimeForDisplay } from "@/lib/utils/datetime";
import {
  WorkflowPanelCollapseButton,
  WorkflowPanelRail,
} from "@/modules/ee/workflows/components/workflow-side-panel";
import { useStoredTestPayload } from "@/modules/ee/workflows/hooks/use-stored-test-payload";
import { useWorkflowWebhook } from "@/modules/ee/workflows/hooks/use-workflow-webhook";
import { getWorkflowApiErrorMessage } from "@/modules/ee/workflows/lib/api-error";
import { getWorkflowRunStatusBadge } from "@/modules/ee/workflows/lib/display";
import type { TRunsViewKind } from "@/modules/ee/workflows/lib/runs-view";
import { getTestRunDrawerPayload } from "@/modules/ee/workflows/lib/test-run";
import type { TWorkflowTestRunFailure } from "@/modules/ee/workflows/state/test-run";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
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

const RUN_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

/** The Webhook workflow's test input: the payload a Test run sends, kept in this browser. */
const WebhookTestInput = ({
  workflowId,
  hasSavedTrigger,
}: Readonly<{ workflowId: string; hasSavedTrigger: boolean }>) => {
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
    />
  );
};

interface RunsTestPanelProps {
  workflowId: string;
  locale: string;
  isCollapsed: boolean;
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

/** "Test the draft": the test input (the payload, or the response to test with), the button, why it failed. */
const TestTheDraftSection = ({
  workflowId,
  locale,
  triggerKind,
  responseTrigger,
  hasSavedWebhookTrigger,
  testRun,
}: Readonly<{
  workflowId: string;
  locale: string;
  triggerKind: RunsTestPanelProps["triggerKind"];
  responseTrigger: TWorkflowResponseCompletedTriggerNode | null;
  hasSavedWebhookTrigger: boolean;
  testRun: TTestRunControls;
}>) => {
  const { t } = useTranslation();
  const { picker: responsePicker, selectedResponseId } = useTestRunResponsePicker({
    open: true,
    workflowId,
    trigger: responseTrigger,
    locale,
  });
  const isResponseTrigger = triggerKind === "response";
  const canStart = !testRun.isRunning && (!isResponseTrigger || selectedResponseId !== null);

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
      <h3 className="text-sm font-medium text-slate-800">{t("workspace.workflows.runs_test_the_draft")}</h3>
      {triggerKind === "webhook" ? (
        <WebhookTestInput workflowId={workflowId} hasSavedTrigger={hasSavedWebhookTrigger} />
      ) : null}
      {isResponseTrigger && testRun.isPickingResponse ? (
        <p className="text-xs text-slate-600">{t("workspace.workflows.runs_pick_response")}</p>
      ) : null}
      {isResponseTrigger ? responsePicker : null}
      <Button
        size="sm"
        className="w-fit"
        loading={testRun.isRunning}
        disabled={!canStart}
        onClick={() => void testRun.startTestRun(selectedResponseId ?? undefined)}>
        <PlayIcon />
        {t("workspace.workflows.runs_test_draft")}
      </Button>
      {testRun.failure ? (
        <Alert variant="error" size="small">
          <AlertDescription>{describeFailure(testRun.failure, testRun.error, t)}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
};

/** The workflow's runs, live and Test, newest first, with All / Live / Test. */
const RunsListSection = (props: Readonly<RunsTestPanelProps>) => {
  const { t } = useTranslation();
  const kinds = [
    ["all", t("common.all")],
    ["live", t("workspace.workflows.runs_filter_live")],
    ["test", t("workspace.workflows.run_test_badge")],
  ] as const;
  return (
    <section className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-800">{t("common.runs")}</h3>
        <fieldset className="m-0 flex rounded-md border-0 bg-slate-100 p-0.5">
          <legend className="sr-only">{t("workspace.workflows.runs_filter")}</legend>
          {kinds.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={props.kind === value}
              onClick={() => props.onKindChange(value)}
              className={cn(
                "rounded px-2 py-0.5 text-xs text-slate-600",
                props.kind === value && "bg-white font-medium text-slate-900 shadow-sm"
              )}>
              {label}
            </button>
          ))}
        </fieldset>
      </div>
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

/** Collapsed: the rail keeps a dot per recent run, to keep clicking through them. */
const RunsTestRail = (props: Readonly<RunsTestPanelProps>) => {
  const { t } = useTranslation();
  return (
    <WorkflowPanelRail
      side="left"
      label={t("workspace.workflows.runs_test_and_runs")}
      onExpand={() => props.onCollapsedChange(false)}>
      <FlaskConicalIcon className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
      <HistoryIcon className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
      {props.runs.slice(0, 8).map((run) => (
        <button
          key={run.id}
          type="button"
          onClick={() => props.onShowRun(run.id)}
          aria-label={t("workspace.workflows.runs_show_run", {
            time: formatDateTimeForDisplay(new Date(run.createdAt), props.locale, RUN_TIME_OPTIONS),
          })}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-slate-100",
            run.id === props.shownRunId && "bg-slate-100"
          )}>
          <span
            className={cn("size-2 rounded-full", run.status === "failed" ? "bg-red-500" : "bg-emerald-500")}
          />
        </button>
      ))}
    </WorkflowPanelRail>
  );
};

/**
 * The Runs view's left panel (review point 1): what to look at. On top, the test input (the payload,
 * or the response to test with) and "Test draft"; below, the workflow's runs, live and Test, to click
 * through while the canvas stays.
 */
export const RunsTestPanel = (props: Readonly<RunsTestPanelProps>) => {
  const { t } = useTranslation();
  if (props.isCollapsed) return <RunsTestRail {...props} />;

  return (
    <aside className="flex min-h-0 w-[320px] shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 py-2 pr-2 pl-4">
        <h2 className="truncate text-sm font-semibold text-slate-900">
          {t("workspace.workflows.runs_test_and_runs")}
        </h2>
        <WorkflowPanelCollapseButton side="left" onCollapse={() => props.onCollapsedChange(true)} />
      </header>
      <div className="scroll-bar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
        {props.canTest ? (
          <TestTheDraftSection
            workflowId={props.workflowId}
            locale={props.locale}
            triggerKind={props.triggerKind}
            responseTrigger={props.responseTrigger}
            hasSavedWebhookTrigger={props.hasSavedWebhookTrigger}
            testRun={props.testRun}
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
        {formatDateTimeForDisplay(new Date(run.createdAt), locale, RUN_TIME_OPTIONS)}
      </time>
      {run.error ? (
        <span className="col-start-2 col-end-4 truncate text-xs text-red-600">{run.error}</span>
      ) : null}
    </button>
  );
};

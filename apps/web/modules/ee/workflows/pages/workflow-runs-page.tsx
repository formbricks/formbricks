"use client";

import { useAtom, useSetAtom, useStore } from "jotai";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { type TWorkflowDefinition, isResponseCompletedTrigger } from "@formbricks/workflows";
import { RunsStepPanel, RunsStepPill } from "@/modules/ee/workflows/components/runs/runs-step-panel";
import { RunsListPill, RunsTestPanel } from "@/modules/ee/workflows/components/runs/runs-test-panel";
import { WorkflowRunCanvas } from "@/modules/ee/workflows/components/runs/workflow-run-canvas";
import { useRunsViewSelection } from "@/modules/ee/workflows/hooks/use-runs-view-selection";
import { useStoredTestPayload } from "@/modules/ee/workflows/hooks/use-stored-test-payload";
import { useWorkflowBuilder } from "@/modules/ee/workflows/hooks/use-workflow-builder";
import { useWorkflowRun } from "@/modules/ee/workflows/hooks/use-workflow-run";
import { useWorkflowRunDefinition } from "@/modules/ee/workflows/hooks/use-workflow-run-definition";
import { useWorkflowRuns } from "@/modules/ee/workflows/hooks/use-workflow-runs";
import { useWorkflowTestRun } from "@/modules/ee/workflows/hooks/use-workflow-test-run";
import { type TRunDetailRow, toRunDetailRows } from "@/modules/ee/workflows/lib/run-detail-rows";
import {
  type TRunsViewKind,
  getTestInputKind,
  pickRunGraph,
  resolveShownRunId,
  toRunsViewListFilters,
} from "@/modules/ee/workflows/lib/runs-view";
import { hasSavedWebhookTrigger } from "@/modules/ee/workflows/lib/workflow-samples";
import { workflowAtom } from "@/modules/ee/workflows/state/editor";
import { isRunsListCollapsedAtom, isTestFormOpenAtom } from "@/modules/ee/workflows/state/test-run";
import type { TWorkflowRunDetail } from "@/modules/ee/workflows/types";
import { Skeleton } from "@/modules/ui/components/skeleton";
import { useTrackWorkflowSurface } from "../hooks/use-track-workflow-surface";

const RUNS_PER_PAGE = 20;

interface WorkflowRunsPageProps {
  workspaceId: string;
  workflowId: string;
  isReadOnly: boolean;
}

/**
 * A workflow's Runs view (review point 1, option A): the run on a read-only canvas of the graph it
 * ran, in the middle; on the left the test input and the list of runs, to click through while the
 * canvas stays; on the right the selected step's part of the run, or the run's summary. The shown run
 * and step live in the URL (`?run=`, `?step=`), so a run can be linked and the Editor can open one.
 */
export const WorkflowRunsPage = ({
  workspaceId,
  workflowId,
  isReadOnly,
}: Readonly<WorkflowRunsPageProps>) => {
  useTrackWorkflowSurface("workflow_runs", { workflowId });
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const { urlRunId, selectedStepId, showRun, selectStep } = useRunsViewSelection();

  // The draft: what a Test run runs, and which test input the trigger takes. The editor store keeps it
  // across the Editor and Runs tabs, so it is only fetched when Runs is opened first: hydrating again
  // would rebuild the editor's state under the Editor tab.
  const store = useStore();
  const [needsDraft] = useState(() => store.get(workflowAtom)?.id !== workflowId);
  const builder = useWorkflowBuilder({ workspaceId, workflowId, isReadOnly, loadOnMount: needsDraft });
  const testRun = useWorkflowTestRun({ workspaceId, workflowId, isReadOnly });
  const [, setStoredPayload] = useStoredTestPayload(workflowId);

  const [kind, setKind] = useState<TRunsViewKind>("all");
  const [isLeftCollapsed, setLeftCollapsed] = useAtom(isRunsListCollapsedAtom);
  const setTestFormOpen = useSetAtom(isTestFormOpenAtom);
  const [isRightCollapsed, setRightCollapsed] = useState(false);

  const runsQuery = useWorkflowRuns({
    workspaceId,
    limit: RUNS_PER_PAGE,
    filters: toRunsViewListFilters(workflowId, kind),
  });
  const shownRunId = resolveShownRunId(urlRunId, runsQuery.runs);
  const runQuery = useWorkflowRun({ runId: shownRunId });
  const runGraphQuery = useWorkflowRunDefinition({ workflowId, runId: shownRunId });

  // A Test run that just came back from "Run test" is the one to look at.
  const lastTestRunIdRef = useRef(testRun.runId);
  useEffect(() => {
    if (!testRun.runId || testRun.runId === lastTestRunIdRef.current) return;
    lastTestRunIdRef.current = testRun.runId;
    showRun(testRun.runId);
  }, [testRun.runId, showRun]);

  const graph = pickRunGraph({
    runDefinition: runGraphQuery.data?.definition ?? null,
    source: runGraphQuery.data?.source ?? null,
    draft: builder.definition,
  });
  const run = runQuery.data;
  const rows = useMemo(
    () => (run && graph.definition ? toRunDetailRows(run, graph.definition) : null),
    [run, graph.definition]
  );

  const trigger = builder.definition?.trigger ?? null;
  const triggerKind = getTestInputKind(builder.definition);
  const canTest = !isReadOnly && builder.workflow?.status !== "archived" && triggerKind !== "none";

  const useAsTestInput = (payload: Record<string, unknown>) => {
    setStoredPayload(JSON.stringify(payload, null, 2));
    setLeftCollapsed(false);
    setTestFormOpen(true);
    toast.success(t("workspace.workflows.runs_used_as_test_input"));
  };

  const isGraphLoading =
    runsQuery.isLoading || (shownRunId !== null && (runGraphQuery.isLoading || builder.isLoading));

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      {isLeftCollapsed ? null : (
        <RunsTestPanel
          workflowId={workflowId}
          locale={locale}
          onCollapsedChange={setLeftCollapsed}
          triggerKind={triggerKind}
          responseTrigger={trigger && isResponseCompletedTrigger(trigger) ? trigger : null}
          hasSavedWebhookTrigger={hasSavedWebhookTrigger(builder.workflow)}
          canTest={canTest}
          testRun={testRun}
          kind={kind}
          onKindChange={setKind}
          runs={runsQuery.runs}
          isLoadingRuns={runsQuery.isLoading}
          hasMoreRuns={runsQuery.hasNextPage}
          isLoadingMoreRuns={runsQuery.isFetchingNextPage}
          onLoadMoreRuns={() => void runsQuery.fetchNextPage()}
          shownRunId={shownRunId}
          onShowRun={showRun}
        />
      )}
      <RunsCanvasSection
        locale={locale}
        isLoading={isGraphLoading}
        definition={graph.definition}
        run={run}
        rows={rows}
        selectedStepId={selectedStepId}
        onSelectStep={selectStep}
        leftPill={
          isLeftCollapsed ? (
            <RunsListPill
              shownRun={runsQuery.runs.find((listed) => listed.id === shownRunId) ?? null}
              onExpand={() => setLeftCollapsed(false)}
            />
          ) : null
        }
        onExpandRight={isRightCollapsed ? () => setRightCollapsed(false) : null}
      />
      {isRightCollapsed ? null : (
        <RunsStepPanel
          workspaceId={workspaceId}
          workflowId={workflowId}
          locale={locale}
          onCollapsedChange={setRightCollapsed}
          definition={graph.definition}
          isDrawnOnCurrentDraft={graph.isCurrentDraft && run !== undefined}
          run={run}
          isLoading={runQuery.isLoading || runsQuery.isLoading}
          isError={runQuery.isError}
          error={runQuery.error}
          rows={rows}
          selectedStepId={selectedStepId}
          onSelectStep={selectStep}
          onUseAsTestInput={canTest && triggerKind === "webhook" ? useAsTestInput : undefined}
          canEditSteps={builder.canEditDefinition}
        />
      )}
    </div>
  );
};

/**
 * The middle of the Runs view: the shown run on its canvas, with the collapsed panels' pills over it,
 * a skeleton while it loads, or a note when there is no run yet.
 */
const RunsCanvasSection = ({
  isLoading,
  definition,
  run,
  rows,
  selectedStepId,
  onSelectStep,
  leftPill,
  onExpandRight,
  locale,
}: Readonly<{
  locale: string;
  isLoading: boolean;
  definition: TWorkflowDefinition | null;
  run: TWorkflowRunDetail | undefined;
  rows: TRunDetailRow[] | null;
  selectedStepId: string | null;
  onSelectStep: (stepId: string | null) => void;
  leftPill: ReactNode;
  /** Set while the right panel is collapsed: its pill expands it. */
  onExpandRight: (() => void) | null;
}>) => {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <section className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Skeleton className="m-4 h-[calc(100%-2rem)] rounded-lg" />
      </section>
    );
  }
  return (
    <section className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {definition ? (
        <WorkflowRunCanvas
          definition={definition}
          run={run ?? null}
          rows={rows}
          selectedStepId={selectedStepId}
          onSelectStep={onSelectStep}
        />
      ) : (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">
          {t("workspace.workflows.runs_none_yet")}
        </div>
      )}
      {leftPill}
      {onExpandRight ? (
        <RunsStepPill
          locale={locale}
          definition={definition}
          run={run}
          rows={rows}
          selectedStepId={selectedStepId}
          onExpand={onExpandRight}
        />
      ) : null}
    </section>
  );
};

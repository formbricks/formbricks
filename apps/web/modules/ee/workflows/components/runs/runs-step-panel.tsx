"use client";

import type { TFunction } from "i18next";
import { ArrowLeftIcon, CopyPlusIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import { WorkflowNodeChip } from "@/modules/ee/workflows/components/canvas/workflow-node-card";
import { WorkflowAlert } from "@/modules/ee/workflows/components/workflow-alert";
import {
  WorkflowPanelCollapseButton,
  WorkflowPanelPill,
} from "@/modules/ee/workflows/components/workflow-side-panel";
import { getNodeRegistryEntry } from "@/modules/ee/workflows/lib/node-registry";
import type { TRunDetailBadge, TRunDetailRow } from "@/modules/ee/workflows/lib/run-detail-rows";
import { formatRunTime } from "@/modules/ee/workflows/lib/runs-view";
import type { TWorkflowRunDetail } from "@/modules/ee/workflows/types";
import { Button } from "@/modules/ui/components/button";
import { RunDetailRow } from "./run-detail-steps";
import { RunStepsBody } from "./run-steps-body";
import { RunSummarySection } from "./run-summary-section";
import { TestRunNotice } from "./workflow-run-detail-drawer";

interface RunsStepPanelProps {
  workspaceId: string;
  workflowId: string;
  locale: string;
  /** Collapsed, the panel is a pill on the run canvas (RunsStepPill). */
  onCollapsedChange: (isCollapsed: boolean) => void;
  /** The graph the run is drawn on, which names its steps. */
  definition: TWorkflowDefinition | null;
  /** The run was made before Test runs saved their draft, so it is drawn on today's draft. */
  isDrawnOnCurrentDraft: boolean;
  run: TWorkflowRunDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  rows: TRunDetailRow[] | null;
  selectedStepId: string | null;
  onSelectStep: (stepId: string | null) => void;
  /** Copies a Webhook run's payload into the test input; absent when the member can't test. */
  onUseAsTestInput?: (payload: Record<string, unknown>) => void;
  canEditSteps: boolean;
}

/** "Test run · Nov 19, 2:42 PM" or "Run · Nov 19, 2:42 PM": the run, as its row in the list names it. */
const getRunTitle = (run: TWorkflowRunDetail | undefined, locale: string, t: TFunction): string => {
  if (!run) return t("workspace.workflows.runs_run");
  const time = formatRunTime(run.createdAt, locale);
  return run.isDryRun
    ? t("workspace.workflows.runs_title_test_run", { time })
    : t("workspace.workflows.runs_title_run", { time });
};

const findNode = (definition: TWorkflowDefinition | null, stepId: string | null) => {
  if (!definition || !stepId) return null;
  if (definition.trigger?.id === stepId) return definition.trigger;
  return definition.nodes.find((node) => node.id === stepId) ?? null;
};

/** "Edit step" opens the step in the Editor; null for the trigger or a member who can't edit. */
const getEditStepHref = (
  { canEditSteps, definition, workspaceId, workflowId }: Readonly<RunsStepPanelProps>,
  stepId: string
): string | null =>
  canEditSteps && stepId !== definition?.trigger?.id
    ? `/workspaces/${workspaceId}/workflows/${workflowId}?node=${encodeURIComponent(stepId)}`
    : null;

/**
 * The Runs view's right panel (review point 1): the selected step's part of the run, drawn as output
 * (values and code, never the settings form), with what to do next: "Use as test input" on the
 * Webhook step and "Edit step" back in the Editor. With no step selected, the run's summary and every
 * step, each opening its card.
 */
export const RunsStepPanel = (props: Readonly<RunsStepPanelProps>) => {
  const { t } = useTranslation();
  const { definition, run, rows, selectedStepId } = props;
  const node = findNode(definition, selectedStepId);
  const entry = node ? getNodeRegistryEntry(node) : null;
  const stepTitle = node && entry ? entry.title(node, t) : null;

  const runTitle = getRunTitle(run, props.locale, t);
  const title = stepTitle ?? runTitle;

  return (
    <aside
      data-testid="workflow-run-panel"
      className="flex min-h-0 w-[380px] shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white 2xl:w-[440px]">
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 py-2 pr-2 pl-4">
        {entry ? <WorkflowNodeChip icon={entry.icon} category={entry.category} size="sm" /> : null}
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{title}</h2>
        {node ? (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-slate-600"
            onClick={() => props.onSelectStep(null)}>
            <ArrowLeftIcon />
            {t("workspace.workflows.runs_all_steps")}
          </Button>
        ) : null}
        <WorkflowPanelCollapseButton side="right" onCollapse={() => props.onCollapsedChange(true)} />
      </header>
      <div className="scroll-bar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {!run && !props.isLoading && !props.isError ? (
          <p className="text-sm text-slate-500">{t("workspace.workflows.runs_none_selected")}</p>
        ) : null}
        {props.isDrawnOnCurrentDraft ? (
          <WorkflowAlert variant="warning">
            {t("workspace.workflows.runs_drawn_on_current_draft")}
          </WorkflowAlert>
        ) : null}
        {node ? (
          <SelectedStepResult
            stepId={node.id}
            isTrigger={node.id === definition?.trigger?.id}
            run={run}
            rows={rows}
            editStepHref={getEditStepHref(props, node.id)}
            onUseAsTestInput={props.onUseAsTestInput}
          />
        ) : (
          <RunOverview {...props} />
        )}
      </div>
    </aside>
  );
};

/** One step's part of the run, and what to do next. */
const SelectedStepResult = ({
  stepId,
  isTrigger,
  run,
  rows,
  editStepHref,
  onUseAsTestInput,
}: Readonly<{
  stepId: string;
  isTrigger: boolean;
  run: TWorkflowRunDetail | undefined;
  rows: TRunDetailRow[] | null;
  /** Null when the member can't edit the step, or for the trigger. */
  editStepHref: string | null;
  onUseAsTestInput?: (payload: Record<string, unknown>) => void;
}>) => {
  const { t } = useTranslation();
  if (!run || !rows) return null;
  const row = rows.find((candidate) =>
    isTrigger ? candidate.kind === "trigger" : candidate.stepId === stepId
  );
  if (!row) return <p className="text-sm text-slate-500">{t("workspace.workflows.runs_step_not_in_run")}</p>;
  const triggerPayload = row.kind === "trigger" ? row.payload : null;

  return (
    <>
      <ol>
        <RunDetailRow
          row={row}
          responseId={run.responseId}
          triggerAction={
            triggerPayload && onUseAsTestInput ? (
              <Button
                variant="secondary"
                size="sm"
                className="w-fit"
                onClick={() => onUseAsTestInput(triggerPayload)}>
                <CopyPlusIcon />
                {t("workspace.workflows.runs_use_as_test_input")}
              </Button>
            ) : null
          }
        />
      </ol>
      {editStepHref ? (
        <Button variant="secondary" size="sm" className="w-fit" asChild>
          <Link href={editStepHref}>
            <PencilIcon />
            {t("workspace.workflows.runs_edit_step")}
          </Link>
        </Button>
      ) : null}
    </>
  );
};

/** With no step selected: the run's summary, then every step, each opening its card. */
const RunOverview = (props: Readonly<RunsStepPanelProps>) => {
  const { run, definition } = props;
  return (
    <>
      {run ? (
        <>
          <RunSummarySection run={run} locale={props.locale} />
          {run.isDryRun ? <TestRunNotice /> : null}
        </>
      ) : null}
      <RunStepsBody
        isLoading={props.isLoading}
        isError={props.isError}
        error={props.error}
        detail={run}
        definition={definition}
        onSelectStep={(stepId) => props.onSelectStep(stepId ?? definition?.trigger?.id ?? null)}
      />
    </>
  );
};

const STEP_DOT: Partial<Record<TRunDetailBadge, "success" | "error" | "gray">> = {
  succeeded: "success",
  sent: "success",
  would_send: "success",
  would_call: "success",
  failed: "error",
  delivery_failed: "error",
  not_taken: "gray",
  skipped: "gray",
};

/**
 * The collapsed right panel (review point 5): a pill at the run canvas's top-right with the selected
 * step (or the run) and its result as a dot, and the expand button.
 */
export const RunsStepPill = ({
  definition,
  run,
  rows,
  selectedStepId,
  locale,
  onExpand,
}: Readonly<{
  locale: string;
  definition: TWorkflowDefinition | null;
  run: TWorkflowRunDetail | undefined;
  rows: TRunDetailRow[] | null;
  selectedStepId: string | null;
  onExpand: () => void;
}>) => {
  const { t } = useTranslation();
  const node = findNode(definition, selectedStepId);
  const entry = node ? getNodeRegistryEntry(node) : null;
  if (node && entry) {
    const row = rows?.find((candidate) => candidate.kind !== "trigger" && candidate.stepId === node.id);
    const stepDot = row && row.kind !== "trigger" ? STEP_DOT[row.badge] : undefined;
    const status = node.id === definition?.trigger?.id ? "success" : stepDot;
    return (
      <WorkflowPanelPill
        side="right"
        icon={<WorkflowNodeChip icon={entry.icon} category={entry.category} size="sm" />}
        label={entry.title(node, t)}
        status={status ?? "gray"}
        onExpand={onExpand}
      />
    );
  }
  let runStatus: "success" | "error" | undefined;
  if (run) runStatus = run.status === "failed" ? "error" : "success";
  return (
    <WorkflowPanelPill
      side="right"
      label={getRunTitle(run, locale, t)}
      status={runStatus}
      onExpand={onExpand}
    />
  );
};

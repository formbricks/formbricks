import { type TWorkflowDefinition, isResponseCompletedTrigger } from "@formbricks/workflows";
import { formatDateTimeForDisplay } from "@/lib/utils/datetime";
import type { TWorkflowRunListFilters } from "@/modules/ee/workflows/lib/api-client";
import type { TRunDetailBadge, TRunDetailRow } from "@/modules/ee/workflows/lib/run-detail-rows";

/**
 * The workflow's Runs view (review point 1): runs drawn on a read-only canvas, a test panel and run
 * list on the left, the selected step's part of the run on the right. Pure helpers, so the view only
 * renders.
 */

export const getWorkflowRunsPath = (workspaceId: string, workflowId: string): string =>
  `/workspaces/${workspaceId}/workflows/${workflowId}/runs`;

/** The run list's filter: every run, only live ones, or only Test runs. */
export type TRunsViewKind = "all" | "live" | "test";

export const toRunsViewListFilters = (workflowId: string, kind: TRunsViewKind): TWorkflowRunListFilters => {
  if (kind === "live") return { workflowId, isDryRun: false };
  if (kind === "test") return { workflowId, isDryRun: true };
  return { workflowId };
};

/** The run the view shows: the one in the URL, else the newest one listed, else none. */
export const resolveShownRunId = (urlRunId: string | null, runs: readonly { id: string }[]): string | null =>
  urlRunId ?? runs[0]?.id ?? null;

/**
 * What the shown run did at each step of the graph it ran, keyed by step id, for the canvas cards.
 * The trigger always "succeeded" (the run exists). A step the run never reached (after a failure, or
 * while it runs) has no row and reads "Didn't run".
 */
export type TRunCanvasBadge = TRunDetailBadge | "not_reached";

export const getRunCanvasBadges = (
  definition: TWorkflowDefinition,
  rows: readonly TRunDetailRow[]
): Map<string, TRunCanvasBadge> => {
  const byStepId = new Map<string, TRunCanvasBadge>();
  for (const row of rows) {
    if (row.kind !== "trigger") byStepId.set(row.stepId, row.badge);
  }
  const badges = new Map<string, TRunCanvasBadge>();
  if (definition.trigger) badges.set(definition.trigger.id, "succeeded");
  for (const node of definition.nodes) {
    badges.set(node.id, byStepId.get(node.id) ?? "not_reached");
  }
  return badges;
};

/** Where a run's graph came from, for the note above the canvas. */
export type TRunGraphSource = "version" | "test_run" | "unknown";

/**
 * The definition to draw a run on: the one the run executed when known, else (a Test run made before
 * Test runs saved their draft) the workflow's current draft, flagged so the view can say so.
 */
export const pickRunGraph = ({
  runDefinition,
  source,
  draft,
}: {
  runDefinition: TWorkflowDefinition | null;
  source: TRunGraphSource | null;
  draft: TWorkflowDefinition | null;
}): { definition: TWorkflowDefinition | null; isCurrentDraft: boolean } => {
  if (runDefinition && source !== "unknown") return { definition: runDefinition, isCurrentDraft: false };
  return { definition: draft, isCurrentDraft: draft !== null };
};

/**
 * What the test panel asks for: a Webhook workflow's payload, a Response completed workflow's response,
 * nothing without a trigger, or null while the draft loads.
 */
export const getTestInputKind = (
  definition: TWorkflowDefinition | null
): "webhook" | "response" | "none" | null => {
  if (!definition) return null;
  if (!definition.trigger) return "none";
  return isResponseCompletedTrigger(definition.trigger) ? "response" : "webhook";
};

const RUN_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

/** When a run started, as the run list and the run's title show it ("Nov 19, 2:42 PM"). */
export const formatRunTime = (createdAt: string, locale: string): string =>
  formatDateTimeForDisplay(new Date(createdAt), locale, RUN_TIME_OPTIONS);

import { capturePostHogClientEvent, capturePostHogClientEventWhenReady } from "@/lib/posthog/client";
import type { TWorkflowValidationProblem } from "@/modules/ee/workflows/state/editor";
import { type TWorkflowClientEvent, type TWorkflowSurface } from "./analytics-events";

export type TWorkflowEventProperties = Record<
  string,
  string | number | boolean | string[] | null | undefined
>;

/**
 * Client-side capture for the Workflows UI (ENG-2851), for events behind a user action. PostHog is
 * initialised lazily by PostHogIdentify and is absent altogether when POSTHOG_KEY is unset, so this
 * is a no-op there. The organization and workspace groups are already attached to the session by
 * PostHogGroupIdentify, so callers pass event facts only.
 */
export const trackWorkflowEvent = (
  event: TWorkflowClientEvent,
  properties?: TWorkflowEventProperties
): void => capturePostHogClientEvent(event, properties);

/**
 * The same for events that fire on mount (a screen being viewed): the capture waits for PostHog to
 * finish initialising and returns a cancel function for the effect cleanup.
 */
export const trackWorkflowEventWhenReady = (
  event: TWorkflowClientEvent,
  properties?: TWorkflowEventProperties
): (() => void) => capturePostHogClientEventWhenReady(event, properties);

/**
 * The problem list as analytics properties: a count plus the distinct codes, sorted so the same
 * set of problems always lands in the same breakdown bucket. Codes only, never the `field` paths,
 * which can carry node ids.
 */
export const summarizeValidationProblems = (
  problems: readonly TWorkflowValidationProblem[]
): { problem_count: number; problem_codes: string[] } => ({
  problem_count: problems.length,
  problem_codes: [...new Set(problems.map((problem) => problem.code))].sort((a, b) => a.localeCompare(b)),
});

export interface WorkflowListSurfaceState {
  isWorkspaceEmpty: boolean;
  showInitialLoading: boolean;
  isError: boolean;
  isListEmpty: boolean;
  isProbingAnyWorkflows: boolean;
  workflowCount: number;
}

/**
 * Which of the three list states the user is actually looking at; `null` while loading or probing,
 * and on an error, none of which count as a visit.
 */
export const resolveWorkflowListSurface = (state: WorkflowListSurfaceState): TWorkflowSurface | null => {
  if (state.isWorkspaceEmpty) return "list_empty";
  if (state.showInitialLoading || state.isError) return null;
  if (state.isListEmpty && state.isProbingAnyWorkflows) return null;
  return state.workflowCount === 0 ? "list_empty_filtered" : "list";
};

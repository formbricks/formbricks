import posthog from "posthog-js";
import type { TWorkflowValidationProblem } from "@/modules/ee/workflows/state/editor";
import { type TWorkflowClientEvent } from "./analytics-events";

export type TWorkflowEventProperties = Record<
  string,
  string | number | boolean | string[] | null | undefined
>;

/**
 * Client-side capture for the Workflows UI (ENG-2851). Same guard the rest of the app uses
 * (`posthog.__loaded`): PostHog is initialised lazily by PostHogIdentify and is absent altogether
 * when POSTHOG_KEY is unset, so this is a no-op there. The organization and workspace groups are
 * already attached to the session by PostHogGroupIdentify, so callers pass event facts only.
 */
export const trackWorkflowEvent = (
  event: TWorkflowClientEvent,
  properties?: TWorkflowEventProperties
): void => {
  if (!posthog.__loaded) return;
  posthog.capture(event, properties);
};

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

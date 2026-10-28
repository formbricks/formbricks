import type { TWorkflowResource, TWorkflowRunListItem } from "@formbricks/workflows";

const TRIGGER_WORDS: Record<string, string> = {
  "response.completed": "a survey response is completed",
};

/** The one sentence the model (and a host without MCP Apps) reads instead of the view. */
export const buildShowWorkflowSummary = (
  workflow: Pick<TWorkflowResource, "name" | "status" | "triggerType" | "definition">,
  recentRuns: readonly Pick<TWorkflowRunListItem, "status" | "isDryRun" | "startedAt" | "createdAt">[]
): string => {
  const steps = workflow.definition.nodes.length;
  const trigger = workflow.triggerType
    ? `runs when ${TRIGGER_WORDS[workflow.triggerType] ?? workflow.triggerType}`
    : "has no trigger yet";
  const lastRun = recentRuns[0];
  const lastRunText = lastRun
    ? `last run ${lastRun.isDryRun ? "(a test) " : ""}${lastRun.status} at ${lastRun.startedAt ?? lastRun.createdAt}`
    : "no runs yet";

  return [
    `Workflow "${workflow.name}" is ${workflow.status}`,
    trigger,
    `${steps} ${steps === 1 ? "step" : "steps"}`,
    `${lastRunText}.`,
  ].join(", ");
};

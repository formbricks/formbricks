import {
  type TWorkflowResource,
  type TWorkflowSampleList,
  type TWorkflowSampleListItem,
  WORKFLOW_SAMPLE_TRIGGER_SOURCE,
  WORKFLOW_TRIGGERS,
  getLastTestSampleSource,
  isLastTestSampleSource,
} from "@formbricks/workflows";
import type { TWorkflowStepVariableContext } from "@/modules/ee/workflows/lib/variable-picker";

/**
 * The Variable picker's step samples from a workflow's saved samples: each HTTP request step's
 * expected response body, keyed by step id (ADR 0054). The trigger's expected payload is not a step output,
 * and a step's last Test request response only counts once an editor chooses to use it.
 */
export const toStepVariableContext = (
  samples: TWorkflowSampleList | undefined
): TWorkflowStepVariableContext => ({
  stepSamples: Object.fromEntries(
    (samples ?? [])
      .filter(
        (entry) => entry.source !== WORKFLOW_SAMPLE_TRIGGER_SOURCE && !isLastTestSampleSource(entry.source)
      )
      .map((entry) => [entry.source, entry.sample])
  ),
});

/** A step's expected response body and its last Test request response, each with when it was saved. */
export const getStepResponseSamples = (
  samples: TWorkflowSampleList | undefined,
  stepId: string
): { expected: TWorkflowSampleListItem | null; lastTest: TWorkflowSampleListItem | null } => ({
  expected: samples?.find((entry) => entry.source === stepId) ?? null,
  lastTest: samples?.find((entry) => entry.source === getLastTestSampleSource(stepId)) ?? null,
});

/**
 * Whether the Webhook Secret URL can be read yet: the saved workflow (not only the draft) has a
 * Webhook trigger, since the server issues the URL when that save lands. Before it, the read answers
 * an error the author has no part in.
 */
export const hasSavedWebhookTrigger = (workflow: Pick<TWorkflowResource, "definition"> | null): boolean =>
  workflow?.definition?.trigger?.triggerType === WORKFLOW_TRIGGERS.WEBHOOK;

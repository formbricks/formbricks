import {
  type TWorkflowDefinition,
  type TWorkflowResource,
  type TWorkflowSampleList,
  WORKFLOW_SAMPLE_TRIGGER_SOURCE,
  WORKFLOW_TRIGGERS,
} from "@formbricks/workflows";
import type { TWorkflowStepVariableContext } from "@/modules/ee/workflows/lib/variable-picker";

/**
 * The Variable picker's step samples from a workflow's saved samples: each HTTP request step's last
 * Test request response, keyed by step id. The trigger's Sample payload is not a step output.
 */
export const toStepVariableContext = (
  samples: TWorkflowSampleList | undefined
): TWorkflowStepVariableContext => ({
  stepSamples: Object.fromEntries(
    (samples ?? [])
      .filter((entry) => entry.source !== WORKFLOW_SAMPLE_TRIGGER_SOURCE)
      .map((entry) => [entry.source, entry.sample])
  ),
});

/**
 * Whether the Webhook Secret URL can be read yet: the saved workflow (not only the draft) has a
 * Webhook trigger, since the server issues the URL when that save lands. Before it, the read answers
 * an error the author has no part in.
 */
export const hasSavedWebhookTrigger = (workflow: Pick<TWorkflowResource, "definition"> | null): boolean =>
  (workflow?.definition as TWorkflowDefinition | undefined)?.trigger?.triggerType ===
  WORKFLOW_TRIGGERS.WEBHOOK;

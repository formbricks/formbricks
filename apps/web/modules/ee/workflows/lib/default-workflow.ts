import { createId } from "@paralleldrive/cuid2";
import {
  type TWorkflowDefinition,
  type TWorkflowTriggerNode,
  type TWorkflowTriggerType,
  WORKFLOW_TRIGGERS,
} from "@formbricks/workflows";

// New workflows start with an empty canvas, or with the trigger picked from "New workflow"; the
// user adds the steps from the canvas pickers instead of getting pre-seeded default nodes.
export const createEmptyWorkflowDefinition = (): TWorkflowDefinition => ({
  schemaVersion: 1,
  trigger: null,
  nodes: [],
  edges: [],
  entryNodeId: null,
});

// Matches WORKFLOW_CANVAS_START_POSITION in definition-to-flow (not imported to avoid a cycle).
const TRIGGER_START_UI = { position: { x: 220, y: 80 } };

/**
 * A new trigger of the given type, as the canvas's trigger picker and "New workflow" add it: a
 * Response completed trigger waits for its survey to be picked, a Webhook trigger needs nothing yet.
 */
export const createDefaultTrigger = (triggerType: TWorkflowTriggerType): TWorkflowTriggerNode => {
  const id = createId();
  if (triggerType === WORKFLOW_TRIGGERS.RESPONSE_COMPLETED) {
    return {
      id,
      type: "trigger",
      triggerType,
      config: { surveyId: createId(), endingCardIds: [] },
      ui: TRIGGER_START_UI,
    };
  }
  return { id, type: "trigger", triggerType: WORKFLOW_TRIGGERS.WEBHOOK, config: {}, ui: TRIGGER_START_UI };
};

/** A new workflow that starts with the trigger picked in "New workflow". */
export const createWorkflowDefinitionWithTrigger = (
  triggerType: TWorkflowTriggerType
): TWorkflowDefinition => {
  const trigger = createDefaultTrigger(triggerType);
  return { ...createEmptyWorkflowDefinition(), trigger, entryNodeId: trigger.id };
};

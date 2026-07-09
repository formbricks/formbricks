import type { TWorkflowDefinition } from "@formbricks/workflows";

// New workflows start with an empty canvas: the user adds the trigger (and actions) from the
// canvas pickers instead of getting pre-seeded default nodes.
export const createEmptyWorkflowDefinition = (): TWorkflowDefinition => ({
  schemaVersion: 1,
  trigger: null,
  nodes: [],
  edges: [],
  entryNodeId: null,
});

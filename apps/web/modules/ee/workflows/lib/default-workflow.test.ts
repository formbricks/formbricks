import { describe, expect, test } from "vitest";
import { WORKFLOW_TRIGGERS, ZCreateWorkflowInput, ZWorkflowDefinition } from "@formbricks/workflows";
import { createEmptyWorkflowDefinition, createWorkflowDefinitionWithTrigger } from "./default-workflow";

describe("createEmptyWorkflowDefinition", () => {
  test("yields a definition that passes ZWorkflowDefinition", () => {
    const result = ZWorkflowDefinition.safeParse(createEmptyWorkflowDefinition());
    expect(result.success).toBe(true);
  });

  test("starts without trigger, nodes, edges, or entry point", () => {
    const definition = createEmptyWorkflowDefinition();

    expect(definition.trigger).toBeNull();
    expect(definition.entryNodeId).toBeNull();
    expect(definition.nodes).toHaveLength(0);
    expect(definition.edges).toHaveLength(0);
  });

  test("is accepted as the definition of a valid create input", () => {
    const result = ZCreateWorkflowInput.safeParse({
      workspaceId: "cpaqkpwhrrj4desofbrjgqud",
      name: "My workflow",
      description: null,
      status: "draft",
      definition: createEmptyWorkflowDefinition(),
    });

    expect(result.success).toBe(true);
  });
});

describe("createWorkflowDefinitionWithTrigger", () => {
  test.each([WORKFLOW_TRIGGERS.WEBHOOK, WORKFLOW_TRIGGERS.RESPONSE_COMPLETED])(
    "starts a %s workflow at its trigger, as a valid create input",
    (triggerType) => {
      const definition = createWorkflowDefinitionWithTrigger(triggerType);

      expect(definition.trigger?.triggerType).toBe(triggerType);
      expect(definition.entryNodeId).toBe(definition.trigger?.id);
      expect(definition.nodes).toHaveLength(0);
      const input = ZCreateWorkflowInput.safeParse({
        workspaceId: "cpaqkpwhrrj4desofbrjgqud",
        name: "My workflow",
        description: null,
        status: "draft",
        definition,
      });
      expect(input.success).toBe(true);
    }
  );
});

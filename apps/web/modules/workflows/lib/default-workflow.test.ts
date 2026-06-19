import { describe, expect, test } from "vitest";
import { ZCreateWorkflowInput, ZWorkflowDefinition } from "@formbricks/workflows";
import { createDefaultWorkflowDefinition } from "./default-workflow";

describe("createDefaultWorkflowDefinition", () => {
  test("yields a definition that passes ZWorkflowDefinition", () => {
    const result = ZWorkflowDefinition.safeParse(createDefaultWorkflowDefinition());
    expect(result.success).toBe(true);
  });

  test("entryNodeId references the trigger node", () => {
    const definition = createDefaultWorkflowDefinition();
    expect(definition.entryNodeId).toBe(definition.trigger.id);
  });

  test("has a response.completed trigger and a single send_email action wired by one edge", () => {
    const definition = createDefaultWorkflowDefinition();

    expect(definition.trigger.triggerType).toBe("response.completed");
    expect(definition.nodes).toHaveLength(1);
    expect(definition.nodes[0]?.type).toBe("action");
    expect(definition.edges).toHaveLength(1);
    expect(definition.edges[0]?.source).toBe(definition.trigger.id);
    expect(definition.edges[0]?.target).toBe(definition.nodes[0]?.id);
  });

  test("generates a fresh cuid2 placeholder surveyId on each call", () => {
    const first = createDefaultWorkflowDefinition();
    const second = createDefaultWorkflowDefinition();

    expect(first.trigger.config.surveyId).not.toBe(second.trigger.config.surveyId);
  });

  test("is accepted as the definition of a valid create input", () => {
    const result = ZCreateWorkflowInput.safeParse({
      workspaceId: "cpaqkpwhrrj4desofbrjgqud",
      name: "My workflow",
      description: null,
      status: "draft",
      definition: createDefaultWorkflowDefinition(),
    });

    expect(result.success).toBe(true);
  });
});

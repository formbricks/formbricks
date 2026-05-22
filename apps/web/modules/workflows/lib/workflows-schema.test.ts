import { describe, expect, test } from "vitest";
import { ZWorkflowDefinition } from "@formbricks/types/workflows";
import { createDefaultWorkflowDefinition } from "./default-workflow";

describe("workflow schemas", () => {
  test("accepts the PoC default workflow definition", () => {
    const definition = createDefaultWorkflowDefinition();

    expect(ZWorkflowDefinition.safeParse(definition).success).toBe(true);
  });

  test("rejects deferred compute actions in PoC workflow JSON", () => {
    const definition = {
      ...createDefaultWorkflowDefinition(),
      nodes: [
        {
          id: "compute-1",
          type: "action",
          actionType: "compute",
          config: {},
        },
      ],
    };

    expect(ZWorkflowDefinition.safeParse(definition).success).toBe(false);
  });

  test("rejects edges pointing to unknown nodes", () => {
    const definition = {
      ...createDefaultWorkflowDefinition(),
      edges: [
        {
          id: "bad-edge",
          source: "trigger-response-completed",
          target: "missing-node",
          branch: "next",
        },
      ],
    };

    const result = ZWorkflowDefinition.safeParse(definition);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected workflow definition to be invalid");
    }
    expect(result.error.issues.some((issue) => issue.message.includes("Unknown edge target"))).toBe(true);
  });

  test("requires explicit then and else paths for If/Else nodes", () => {
    const definition = {
      ...createDefaultWorkflowDefinition(),
      edges: createDefaultWorkflowDefinition().edges.filter((edge) => edge.branch !== "else"),
    };

    const result = ZWorkflowDefinition.safeParse(definition);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected workflow definition to be invalid");
    }
    expect(
      result.error.issues.some((issue) => issue.message.includes("must have exactly one else edge"))
    ).toBe(true);
  });
});

import { describe, expect, test } from "vitest";
import {
  MAX_WORKFLOW_NODE_ID_LENGTH,
  WORKFLOW_SAMPLE_LAST_CALL_SOURCE,
  WORKFLOW_TRIGGER_SAMPLE_SOURCES,
  ZWorkflowDefinition,
  ZWorkflowDefinitionInput,
  ZWorkflowEnableDefinition,
  getWorkflowNodeIdProblem,
} from ".";

// What the editor's generator (`createId` from @paralleldrive/cuid2) produces: 24 lowercase letters and digits.
const CUID2_ID = "cm9zr4mps000008l8btfy1vtz";

const definitionWith = (triggerId: string, stepId: string) => ({
  schemaVersion: 1,
  trigger: { id: triggerId, type: "trigger", triggerType: "webhook", config: {} },
  nodes: [
    {
      id: stepId,
      type: "action",
      actionType: "http_request",
      config: { method: "POST", url: "https://example.com/hook", headers: [] },
    },
  ],
  edges: [{ id: "edge", source: triggerId, target: stepId }],
  entryNodeId: triggerId,
});

const issuesAt = (definition: ReturnType<typeof definitionWith>, path: (string | number)[]): string[] => {
  const parsed = ZWorkflowDefinitionInput.safeParse(definition);
  if (parsed.success) return [];
  return parsed.error.issues
    .filter((issue) => JSON.stringify(issue.path) === JSON.stringify(path))
    .map((issue) => issue.message);
};

describe("getWorkflowNodeIdProblem", () => {
  test.each([CUID2_ID, "send-email", "step_1", "A-Z_09", "x".repeat(MAX_WORKFLOW_NODE_ID_LENGTH)])(
    "accepts %s as a step id",
    (id) => {
      expect(getWorkflowNodeIdProblem(id, "step")).toBeNull();
    }
  );

  test.each(["a:b", "a.b", "a b", "a/b", "é", `${CUID2_ID}:last_test`])(
    "refuses %s, which holds a character outside letters, digits, _ and -",
    (id) => {
      expect(getWorkflowNodeIdProblem(id, "step")).toBe(
        `Node id ${id} can only contain letters, digits, _ and -`
      );
      expect(getWorkflowNodeIdProblem(id, "trigger")).not.toBeNull();
    }
  );

  test("refuses an id over the length cap", () => {
    expect(getWorkflowNodeIdProblem("x".repeat(MAX_WORKFLOW_NODE_ID_LENGTH + 1), "step")).toBe(
      `A node id can be at most ${MAX_WORKFLOW_NODE_ID_LENGTH} characters`
    );
  });

  test.each([...WORKFLOW_TRIGGER_SAMPLE_SOURCES, "trigger_future_source"])(
    "refuses the trigger sample source name %s as a step id",
    (id) => {
      expect(getWorkflowNodeIdProblem(id, "step")).toBe(
        `Step id ${id} is reserved: a step id can't be trigger or start with trigger_`
      );
    }
  );

  test.each(["__proto__", "prototype", "constructor"])("refuses %s, which Variable paths refuse", (id) => {
    expect(getWorkflowNodeIdProblem(id, "step")).toBe(`Step id ${id} is reserved`);
  });

  test("lets the trigger be called trigger: its id is never a sample source", () => {
    expect(getWorkflowNodeIdProblem("trigger", "trigger")).toBeNull();
  });

  test("keeps step ids that only look like a reserved name", () => {
    expect(getWorkflowNodeIdProblem("triggered", "step")).toBeNull();
    expect(getWorkflowNodeIdProblem("Trigger_last_call", "step")).toBeNull();
  });
});

describe("node ids on save", () => {
  test("accepts the ids the editor generates", () => {
    expect(
      ZWorkflowDefinitionInput.safeParse(definitionWith(CUID2_ID, `${CUID2_ID.slice(0, -1)}x`)).success
    ).toBe(true);
  });

  test("refuses a step id with a colon, at the step's id", () => {
    expect(issuesAt(definitionWith("trigger", "a:b"), ["nodes", 0, "id"])).toEqual([
      "Node id a:b can only contain letters, digits, _ and -",
    ]);
  });

  test("refuses a step id that is the Webhook trigger's last call sample source", () => {
    expect(issuesAt(definitionWith("trigger", WORKFLOW_SAMPLE_LAST_CALL_SOURCE), ["nodes", 0, "id"])).toEqual(
      ["Step id trigger_last_call is reserved: a step id can't be trigger or start with trigger_"]
    );
  });

  test("refuses a trigger id with a colon, at the trigger's id", () => {
    expect(issuesAt(definitionWith("t:1", "step"), ["trigger", "id"])).toEqual([
      "Node id t:1 can only contain letters, digits, _ and -",
    ]);
  });

  test("refuses them on enable too", () => {
    expect(ZWorkflowEnableDefinition.safeParse(definitionWith("trigger", "a:b")).success).toBe(false);
  });

  test("still reads a stored definition saved before the rule", () => {
    expect(ZWorkflowDefinition.safeParse(definitionWith("trigger", "a:b")).success).toBe(true);
    expect(ZWorkflowDefinition.safeParse(definitionWith("trigger", "trigger_last_call")).success).toBe(true);
  });
});

import { describe, expect, test } from "vitest";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import type { TWorkflowValidity } from "@/modules/workflows/state/editor";
import { getWorkflowReadinessHint } from "./workflow-readiness";

const readyValidity: TWorkflowValidity = {
  isNameValid: true,
  isDefinitionExecutable: true,
  hasBoundTriggerSurvey: true,
  isReady: true,
};

const unready = (overrides: Partial<TWorkflowValidity> = {}): TWorkflowValidity => ({
  ...readyValidity,
  isReady: false,
  ...overrides,
});

const emailConfig = {
  to: "jane@example.com",
  from: "noreply@example.com",
  replyTo: [],
  subject: "Thanks",
  body: "Thanks for your response.",
  attachResponseData: false,
};

const buildDefinition = (overrides: Partial<TWorkflowDefinition> = {}): TWorkflowDefinition =>
  ({
    schemaVersion: 1,
    trigger: {
      id: "trigger-1",
      type: "trigger",
      triggerType: "response.completed",
      config: { surveyId: "cm9zr4mps000008l8btfy1vtz", endingCardIds: [] },
    },
    nodes: [{ id: "email-1", type: "action", actionType: "send_email", config: { ...emailConfig } }],
    edges: [{ id: "e1", source: "trigger-1", target: "email-1" }],
    entryNodeId: "trigger-1",
    ...overrides,
  }) as unknown as TWorkflowDefinition;

describe("getWorkflowReadinessHint", () => {
  test("returns null for a ready workflow", () => {
    expect(getWorkflowReadinessHint(buildDefinition(), readyValidity)).toBeNull();
  });

  test("a trigger-less draft asks for a trigger first", () => {
    const definition = buildDefinition({ trigger: null, nodes: [], edges: [], entryNodeId: null });
    expect(getWorkflowReadinessHint(definition, unready({ isDefinitionExecutable: false }))).toBe(
      "add_trigger"
    );
  });

  test("an unbound trigger survey asks to complete the trigger", () => {
    expect(getWorkflowReadinessHint(buildDefinition(), unready({ hasBoundTriggerSurvey: false }))).toBe(
      "complete_trigger"
    );
  });

  test("a trigger without steps asks for an action", () => {
    const definition = buildDefinition({ nodes: [], edges: [] });
    expect(getWorkflowReadinessHint(definition, unready({ isDefinitionExecutable: false }))).toBe(
      "add_action"
    );
  });

  test("an incomplete send_email asks to complete the action", () => {
    const definition = buildDefinition();
    (definition.nodes[0] as { config: { subject: string } }).config.subject = " ";
    expect(getWorkflowReadinessHint(definition, unready({ isDefinitionExecutable: false }))).toBe(
      "complete_action"
    );
  });

  test("a missing name is asked for last", () => {
    expect(getWorkflowReadinessHint(buildDefinition(), unready({ isNameValid: false }))).toBe("name_missing");
  });

  test("structural problems fall back to not_executable", () => {
    // Complete steps and a name, but the graph itself is invalid (e.g. a cycle).
    expect(getWorkflowReadinessHint(buildDefinition(), unready({ isDefinitionExecutable: false }))).toBe(
      "not_executable"
    );
  });
});

import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import type { TWorkflowValidationProblem } from "@/modules/ee/workflows/state/editor";
import {
  getWorkflowRunLogStatusBadge,
  getWorkflowRunStatusBadge,
  getWorkflowStatusBadge,
  getWorkflowTriggerTypeLabel,
  getWorkflowValidationProblemLocation,
} from "./display";

// Identity translator so assertions can check the i18n key each helper resolves.
const t = ((key: string) => key) as unknown as TFunction;

describe("getWorkflowStatusBadge", () => {
  test.each([
    ["enabled", "common.enabled", "success"],
    ["disabled", "common.disabled", "gray"],
    ["archived", "common.archived", "gray"],
    ["draft", "common.draft", "gray"],
  ] as const)("maps %s to label %s / type %s", (status, label, type) => {
    expect(getWorkflowStatusBadge(status, t)).toEqual({ label, type });
  });
});

describe("getWorkflowRunStatusBadge", () => {
  test.each([
    ["completed", "common.completed", "success"],
    ["failed", "common.failed", "error"],
    ["running", "common.running", "warning"],
    ["canceled", "common.canceled", "gray"],
    ["queued", "common.queued", "gray"],
  ] as const)("maps %s to label %s / type %s", (status, label, type) => {
    expect(getWorkflowRunStatusBadge(status, t)).toEqual({ label, type });
  });
});

describe("getWorkflowRunLogStatusBadge", () => {
  test.each([
    ["succeeded", "common.succeeded", "success"],
    ["failed", "common.failed", "error"],
    ["running", "common.running", "warning"],
    ["skipped", "common.skipped", "gray"],
    ["pending", "common.pending", "gray"],
  ] as const)("maps %s to label %s / type %s", (status, label, type) => {
    expect(getWorkflowRunLogStatusBadge(status, t)).toEqual({ label, type });
  });
});

describe("getWorkflowTriggerTypeLabel", () => {
  test("maps response.completed to its label key", () => {
    expect(getWorkflowTriggerTypeLabel("response.completed", t)).toBe("common.response_completed");
  });
});

describe("getWorkflowValidationProblemLocation", () => {
  const definition = {
    schemaVersion: 1,
    entryNodeId: "trigger-1",
    trigger: {
      id: "trigger-1",
      type: "trigger",
      triggerType: "response.completed",
      config: { surveyId: "survey-1", endingCardIds: [] },
    },
    nodes: [
      { id: "email-1", type: "action", actionType: "send_email", label: "Welcome email", config: {} },
      { id: "email-2", type: "action", actionType: "send_email", config: {} },
      { id: "ifelse-1", type: "if_else", config: {} },
    ],
    edges: [],
  } as unknown as TWorkflowDefinition;

  const problem = (field: string): TWorkflowValidationProblem => ({ code: "definition_invalid", field });

  test("resolves nodes.N fields to the step's canvas title (user label first)", () => {
    expect(getWorkflowValidationProblemLocation(problem("nodes.0.config"), definition, t)).toBe(
      "Welcome email"
    );
    expect(getWorkflowValidationProblemLocation(problem("nodes.1.config"), definition, t)).toBe(
      "workspace.workflows.send_email"
    );
    expect(getWorkflowValidationProblemLocation(problem("nodes.2.type"), definition, t)).toBe(
      "workspace.workflows.if_else"
    );
  });

  test("resolves trigger config fields to the trigger's title", () => {
    expect(getWorkflowValidationProblemLocation(problem("trigger.config.surveyId"), definition, t)).toBe(
      "workspace.workflows.response_completed"
    );
    expect(getWorkflowValidationProblemLocation(problem("trigger.config.endingCardIds"), definition, t)).toBe(
      "workspace.workflows.response_completed"
    );
  });

  test("whole-flow and unresolvable fields carry no location", () => {
    expect(getWorkflowValidationProblemLocation(problem("name"), definition, t)).toBeNull();
    expect(getWorkflowValidationProblemLocation(problem("trigger"), definition, t)).toBeNull();
    expect(getWorkflowValidationProblemLocation(problem("edges"), definition, t)).toBeNull();
    expect(getWorkflowValidationProblemLocation(problem("nodes"), definition, t)).toBeNull();
    expect(getWorkflowValidationProblemLocation(problem("nodes.9.config"), definition, t)).toBeNull();
    expect(getWorkflowValidationProblemLocation(problem("nodes.0.config"), null, t)).toBeNull();
    // Trigger-scoped field on a trigger-less draft (unreachable in practice; guard anyway).
    const triggerless = { ...definition, trigger: null } as unknown as TWorkflowDefinition;
    expect(
      getWorkflowValidationProblemLocation(problem("trigger.config.surveyId"), triggerless, t)
    ).toBeNull();
  });
});

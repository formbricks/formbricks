import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import type { TWorkflowValidationProblem } from "@/modules/ee/workflows/state/editor";
import {
  getWorkflowRunLogStatusBadge,
  getWorkflowRunStatusBadge,
  getWorkflowStatusBadge,
  getWorkflowTriggerTypeLabel,
  getWorkflowValidationProblemFocusTarget,
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

describe("getWorkflowValidationProblemFocusTarget", () => {
  const buildDefinition = (emailConfig: Record<string, string>): TWorkflowDefinition =>
    ({
      schemaVersion: 1,
      entryNodeId: "trigger-1",
      trigger: {
        id: "trigger-1",
        type: "trigger",
        triggerType: "response.completed",
        config: { surveyId: "survey-1", endingCardIds: [] },
      },
      nodes: [
        { id: "email-1", type: "action", actionType: "send_email", config: emailConfig },
        { id: "ifelse-1", type: "if_else", config: {} },
      ],
      edges: [],
    }) as unknown as TWorkflowDefinition;

  const problem = (field: string): TWorkflowValidationProblem => ({ code: "step_incomplete", field });

  test("points a step-level problem at the first blank required field, in form order", () => {
    const definition = buildDefinition({ to: "", subject: "", body: "" });
    expect(getWorkflowValidationProblemFocusTarget(problem("nodes.0.config"), definition)).toEqual({
      nodeId: "email-1",
      field: "to",
    });
  });

  test("skips already-filled fields", () => {
    const definition = buildDefinition({ to: "user@example.com", subject: "", body: "<p>Hi</p>" });
    expect(getWorkflowValidationProblemFocusTarget(problem("nodes.0.config"), definition)).toEqual({
      nodeId: "email-1",
      field: "subject",
    });
  });

  test("points at a body that only holds the editor's empty markup", () => {
    const definition = buildDefinition({ to: "user@example.com", subject: "Hi", body: "<p><br></p>" });
    expect(getWorkflowValidationProblemFocusTarget(problem("nodes.0.config"), definition)).toEqual({
      nodeId: "email-1",
      field: "body",
    });
  });

  test("points trigger config problems at the survey picker", () => {
    const definition = buildDefinition({ to: "a", subject: "b", body: "c" });
    for (const field of ["trigger.config.surveyId", "trigger.config.endingCardIds"]) {
      expect(getWorkflowValidationProblemFocusTarget(problem(field), definition)).toEqual({
        nodeId: "trigger-1",
        field: "surveyId",
      });
    }
  });

  test("has no target for problems that aren't fixed in a config form", () => {
    const definition = buildDefinition({ to: "a", subject: "b", body: "c" });
    // Nothing blank on the step, an unsupported node type, whole-flow problems, and out-of-range
    // or trigger-less paths all leave the row passive rather than jumping somewhere arbitrary.
    expect(getWorkflowValidationProblemFocusTarget(problem("nodes.0.config"), definition)).toBeNull();
    expect(getWorkflowValidationProblemFocusTarget(problem("nodes.1.type"), definition)).toBeNull();
    expect(getWorkflowValidationProblemFocusTarget(problem("nodes.9.config"), definition)).toBeNull();
    expect(getWorkflowValidationProblemFocusTarget(problem("name"), definition)).toBeNull();
    expect(getWorkflowValidationProblemFocusTarget(problem("trigger"), definition)).toBeNull();
    expect(getWorkflowValidationProblemFocusTarget(problem("edges"), definition)).toBeNull();
    expect(getWorkflowValidationProblemFocusTarget(problem("nodes.0.config"), null)).toBeNull();
    const triggerless = { ...definition, trigger: null } as unknown as TWorkflowDefinition;
    expect(
      getWorkflowValidationProblemFocusTarget(problem("trigger.config.surveyId"), triggerless)
    ).toBeNull();
  });
});

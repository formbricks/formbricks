import { describe, expect, test } from "vitest";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import { hasSavedWebhookTrigger, toStepVariableContext } from "./workflow-samples";

const definitionWithTrigger = (triggerType: "webhook" | "response.completed" | null) =>
  ({
    trigger:
      triggerType === null
        ? null
        : triggerType === "webhook"
          ? { id: "t", type: "trigger", triggerType, config: {} }
          : { id: "t", type: "trigger", triggerType, config: { surveyId: "s", endingCardIds: [] } },
    nodes: [],
    edges: [],
  }) as unknown as TWorkflowDefinition;

describe("toStepVariableContext", () => {
  test("keys each HTTP request step's last response by step id, leaving the trigger's payload out", () => {
    expect(
      toStepVariableContext([
        { source: "trigger", sample: { email: "a@b.co" }, updatedAt: "2026-11-13T09:00:00.000Z" },
        {
          source: "call_crm",
          sample: { status: 200, body: { tier: "gold" } },
          updatedAt: "2026-11-13T09:00:00.000Z",
        },
      ])
    ).toEqual({ stepSamples: { call_crm: { status: 200, body: { tier: "gold" } } } });
  });

  test("is empty before the samples load", () => {
    expect(toStepVariableContext(undefined)).toEqual({ stepSamples: {} });
  });
});

describe("hasSavedWebhookTrigger", () => {
  test("only a saved Webhook trigger has a Secret URL to read", () => {
    expect(hasSavedWebhookTrigger({ definition: definitionWithTrigger("webhook") })).toBe(true);
    expect(hasSavedWebhookTrigger({ definition: definitionWithTrigger("response.completed") })).toBe(false);
    expect(hasSavedWebhookTrigger({ definition: definitionWithTrigger(null) })).toBe(false);
    expect(hasSavedWebhookTrigger(null)).toBe(false);
  });
});

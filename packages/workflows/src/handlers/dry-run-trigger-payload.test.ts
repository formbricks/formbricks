import { describe, expect, test } from "vitest";
import type { TWorkflowDefinition } from "../types/document";
import type { TResponseCompletedTriggerConfig } from "../types/triggers/response-completed";
import {
  buildDryRunTriggerPayload,
  getResponseCompletedTriggerConfig,
  selectSampleEndingCardId,
} from "./dry-run-trigger-payload";

// Valid cuid2 values (mirroring packages/workflows/src/handlers/serializers.test.ts).
const workspaceId = "cm9zr4mps000008l8btfy1vtz";
const surveyId = "cm9zr4q7i000108l84gozfggr";
const responseId = "cm9zr4w9d000308l8c5n8xk7e";
const endingCardId = "cm9zr4t2b000208l8h2m1aq3c";
const triggeredAt = "2026-06-12T10:00:00.000Z";

const triggerWithEnding: TResponseCompletedTriggerConfig = { surveyId, endingCardIds: [endingCardId] };
const triggerAnyEnding: TResponseCompletedTriggerConfig = { surveyId, endingCardIds: [] };

const definitionWithTrigger = {
  trigger: {
    id: "trigger",
    type: "trigger" as const,
    triggerType: "response.completed" as const,
    config: triggerWithEnding,
  },
} as unknown as TWorkflowDefinition;

describe("getResponseCompletedTriggerConfig", () => {
  test("returns the response.completed trigger config", () => {
    expect(getResponseCompletedTriggerConfig(definitionWithTrigger)).toEqual(triggerWithEnding);
  });
});

describe("selectSampleEndingCardId", () => {
  test("returns the first configured ending", () => {
    expect(selectSampleEndingCardId(triggerWithEnding)).toBe(endingCardId);
  });

  test("returns undefined when no endings are configured (any ending)", () => {
    expect(selectSampleEndingCardId(triggerAnyEnding)).toBeUndefined();
  });
});

describe("buildDryRunTriggerPayload", () => {
  test("synthesized payload carries the trigger survey and a sample ending", () => {
    const payload = buildDryRunTriggerPayload({
      workspaceId,
      trigger: triggerWithEnding,
      source: { responseId, endingCardId: selectSampleEndingCardId(triggerWithEnding) },
      triggeredAt,
    });

    expect(payload).toEqual({
      type: "response.completed",
      workspaceId,
      surveyId,
      responseId,
      endingCardId,
      triggeredAt,
    });
  });

  test("replayed payload passes the response data through", () => {
    const data = { question_1: "Great", nps: 9 };
    const payload = buildDryRunTriggerPayload({
      workspaceId,
      trigger: triggerWithEnding,
      source: { responseId, endingCardId, data },
      triggeredAt,
    });

    expect(payload.data).toEqual(data);
    expect(payload.surveyId).toBe(surveyId);
    expect(payload.responseId).toBe(responseId);
  });

  test("omits endingCardId and data when not provided", () => {
    const payload = buildDryRunTriggerPayload({
      workspaceId,
      trigger: triggerAnyEnding,
      source: { responseId },
      triggeredAt,
    });

    expect(payload).not.toHaveProperty("endingCardId");
    expect(payload).not.toHaveProperty("data");
  });

  test("rejects a malformed payload before a run is created", () => {
    expect(() =>
      buildDryRunTriggerPayload({
        workspaceId,
        trigger: triggerWithEnding,
        source: { responseId: "not-a-cuid2" },
        triggeredAt,
      })
    ).toThrow();

    expect(() =>
      buildDryRunTriggerPayload({
        workspaceId,
        trigger: triggerWithEnding,
        source: { responseId },
        triggeredAt: "not-a-date",
      })
    ).toThrow();

    expect(() =>
      buildDryRunTriggerPayload({
        workspaceId,
        trigger: triggerWithEnding,
        source: { responseId, endingCardId: "not-a-cuid2" },
        triggeredAt,
      })
    ).toThrow();
  });
});

import { describe, expect, test } from "vitest";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import { reconcileDefinitionEndingCardIds, reconcileEndingCardIds } from "./trigger-ending-cards";

const buildDefinition = (endingCardIds: string[]): TWorkflowDefinition =>
  ({
    schemaVersion: 1,
    trigger: {
      id: "trigger_1",
      type: "trigger",
      triggerType: "response.completed",
      config: { surveyId: "survey_1", endingCardIds },
    },
    nodes: [],
    edges: [],
    entryNodeId: "trigger_1",
  }) as unknown as TWorkflowDefinition;

describe("reconcileEndingCardIds", () => {
  test("keeps ids that still exist on the survey, in their stored order", () => {
    expect(reconcileEndingCardIds(["end_2", "end_1"], ["end_1", "end_2", "end_3"])).toEqual({
      endingCardIds: ["end_2", "end_1"],
      removedEndingCardIds: [],
    });
  });

  test("separates ids whose ending was deleted from the survey", () => {
    expect(reconcileEndingCardIds(["deleted_1", "end_1", "deleted_2"], ["end_1"])).toEqual({
      endingCardIds: ["end_1"],
      removedEndingCardIds: ["deleted_1", "deleted_2"],
    });
  });

  test("drops duplicates without reporting them as missing endings", () => {
    expect(reconcileEndingCardIds(["end_1", "end_1", "gone", "gone"], ["end_1"])).toEqual({
      endingCardIds: ["end_1"],
      removedEndingCardIds: ["gone"],
    });
  });

  test("removes everything when the survey has no endings left", () => {
    expect(reconcileEndingCardIds(["end_1", "end_2"], [])).toEqual({
      endingCardIds: [],
      removedEndingCardIds: ["end_1", "end_2"],
    });
  });

  test("is a no-op for an empty selection (= all endings)", () => {
    expect(reconcileEndingCardIds([], ["end_1"])).toEqual({
      endingCardIds: [],
      removedEndingCardIds: [],
    });
  });
});

describe("reconcileDefinitionEndingCardIds", () => {
  test("returns null when the stored selection is already clean", () => {
    expect(reconcileDefinitionEndingCardIds(buildDefinition(["end_1"]), ["end_1", "end_2"])).toBeNull();
  });

  test("returns null without a definition or without a trigger", () => {
    expect(reconcileDefinitionEndingCardIds(null, ["end_1"])).toBeNull();
    const triggerless = { ...buildDefinition([]), trigger: null } as unknown as TWorkflowDefinition;
    expect(reconcileDefinitionEndingCardIds(triggerless, ["end_1"])).toBeNull();
  });

  test("prunes stale ids into a new definition and leaves the original untouched", () => {
    const definition = buildDefinition(["deleted_1", "end_1"]);
    const result = reconcileDefinitionEndingCardIds(definition, ["end_1"]);

    expect(result?.removedEndingCardIds).toEqual(["deleted_1"]);
    expect(result?.definition.trigger?.config.endingCardIds).toEqual(["end_1"]);
    expect(result?.definition).not.toBe(definition);
    expect(definition.trigger?.config.endingCardIds).toEqual(["deleted_1", "end_1"]);
  });

  test("reports a change for duplicate-only drift even though nothing is missing", () => {
    const result = reconcileDefinitionEndingCardIds(buildDefinition(["end_1", "end_1"]), ["end_1"]);

    expect(result?.definition.trigger?.config.endingCardIds).toEqual(["end_1"]);
    expect(result?.removedEndingCardIds).toEqual([]);
  });
});

import { describe, expect, test } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getInvalidSurveyTargets, isFlowTabIssue } from "./invalid-survey-targets";

const survey = {
  blocks: [
    {
      id: "block-1",
      elements: [{ id: "el-1" }, { id: "el-2" }],
      logic: [{ id: "rule-1" }, { id: "rule-2" }],
    },
    { id: "block-2", elements: [{ id: "el-3" }] },
  ],
  startLogic: [{ id: "start-rule-1" }],
  endings: [{ id: "ending-1" }],
} as unknown as TSurvey;

const targets = (...paths: PropertyKey[][]) =>
  getInvalidSurveyTargets(
    survey,
    paths.map((path) => ({ path }))
  );

describe("getInvalidSurveyTargets", () => {
  test("flags an element and scrolls to it", () => {
    expect(targets(["blocks", 0, "elements", 1, "headline"])).toEqual({
      invalidIds: ["el-2"],
      firstInvalidScrollId: "el-2",
    });
  });

  test("flags a block with an empty name", () => {
    expect(targets(["blocks", 1, "name"])).toEqual({
      invalidIds: ["block-2"],
      firstInvalidScrollId: "block-2",
    });
  });

  test("flags one logic rule, or every rule of the block for a block-scope logic issue", () => {
    expect(targets(["blocks", 0, "logic", 1])).toEqual({
      invalidIds: ["rule-2"],
      firstInvalidScrollId: "rule-2",
    });
    expect(targets(["blocks", 0, "logic"])).toEqual({
      invalidIds: ["rule-1", "rule-2"],
      firstInvalidScrollId: "rule-1",
    });
  });

  test("flags nothing for block-scope logic on a block without rules", () => {
    expect(targets(["blocks", 1, "logic"])).toEqual({ invalidIds: [], firstInvalidScrollId: null });
  });

  test("flags a start rule, the welcome card and an ending", () => {
    expect(targets(["startLogic", 0, "conditions"])).toEqual({
      invalidIds: ["start-rule-1"],
      firstInvalidScrollId: "start-rule-1",
    });
    expect(targets(["welcomeCard", "headline"])).toEqual({
      invalidIds: ["start"],
      firstInvalidScrollId: "start",
    });
    expect(targets(["endings", 0, "headline"])).toEqual({
      invalidIds: ["ending-1"],
      firstInvalidScrollId: "ending-1",
    });
  });

  test("ignores paths it cannot place, and indexes past the end", () => {
    expect(targets(["name"], ["endings", "x"], ["blocks", 5, "elements", 0], ["startLogic", 3])).toEqual({
      invalidIds: [],
      firstInvalidScrollId: null,
    });
  });

  test("keeps issue order without repeats, and scrolls to the first issue that names a card", () => {
    expect(
      targets(
        ["name"],
        ["blocks", 0, "elements", 0, "headline"],
        ["blocks", 0, "logic"],
        ["blocks", 0, "logic", 0],
        ["blocks", 0, "elements", 0, "subheader"]
      )
    ).toEqual({
      invalidIds: ["el-1", "rule-1", "rule-2"],
      firstInvalidScrollId: "el-1",
    });
  });
});

describe("isFlowTabIssue", () => {
  test("is true for start rules and for block logic and fallbacks", () => {
    expect(isFlowTabIssue(["startLogic", 0])).toBe(true);
    expect(isFlowTabIssue(["blocks", 0, "logic", 1])).toBe(true);
    expect(isFlowTabIssue(["blocks", 0, "logicFallback"])).toBe(true);
  });

  test("is false for anything else", () => {
    expect(isFlowTabIssue(["blocks", 0, "elements", 0])).toBe(false);
    expect(isFlowTabIssue(["endings", 0, "logic"])).toBe(false);
  });
});

import { describe, expect, test } from "vitest";
import type { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import {
  SURVEY_FLOW_FIXTURE_IDS as ids,
  surveyFlowFixture,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import type { TSurvey } from "@formbricks/types/surveys/types";
import {
  START_SCOPE_BLOCK_IDX,
  createRule,
  duplicateRule,
  getAllowedActionObjectives,
  getDefaultStartCondition,
  getNextActionObjective,
  getObjectivesForAction,
  moveRule,
  removeRule,
  setBlockLogicFallback,
  setBlockRules,
  setStartRules,
  updateRuleActions,
  updateRuleConditions,
} from "./rule-list";

const overallRules = (): TSurveyBlockLogic[] => structuredClone(surveyFlowFixture.blocks[4].logic ?? []);
const ruleIds = (rules: TSurveyBlockLogic[]) => rules.map((rule) => rule.id);

describe("rule list operations work on any list of rules", () => {
  test("move reorders without touching the other rules", () => {
    const rules = overallRules();
    const [a, b, c, d] = ruleIds(rules);

    expect(ruleIds(moveRule(rules, 0, 2))).toEqual([b, c, a, d]);
    expect(ruleIds(moveRule(rules, 3, 0))).toEqual([d, a, b, c]);
    // Out of range is a no-op rather than a rule lost off the end.
    expect(ruleIds(moveRule(rules, 0, 4))).toEqual([a, b, c, d]);
    expect(ruleIds(rules)).toEqual([a, b, c, d]);
  });

  test("remove drops one rule", () => {
    const rules = overallRules();
    const [a, , c, d] = ruleIds(rules);

    expect(ruleIds(removeRule(rules, 1))).toEqual([a, c, d]);
  });

  test("duplicate inserts a copy below with fresh ids for the rule, its conditions and actions", () => {
    const rules = overallRules();
    const copy = duplicateRule(rules, 1)[2];

    expect(copy.id).not.toBe(rules[1].id);
    expect(copy.conditions.id).not.toBe(rules[1].conditions.id);
    expect(copy.actions[0].id).not.toBe(rules[1].actions[0].id);
    expect({ ...copy.actions[0], id: "" }).toEqual({ ...rules[1].actions[0], id: "" });
    expect(duplicateRule(rules, 1)).toHaveLength(5);
  });

  test("a rule whose last condition is removed is removed", () => {
    const rules = overallRules();
    const emptied = updateRuleConditions(rules, 0, (group) => ({ ...group, conditions: [] }));

    expect(ruleIds(emptied)).toEqual(ruleIds(rules).slice(1));
  });

  test("changing conditions or actions changes only that rule", () => {
    const rules = overallRules();
    const updated = updateRuleConditions(rules, 2, (group) => ({ ...group, connector: "or" }));
    expect(updated[2].conditions.connector).toBe("or");
    expect(updated[1]).toEqual(rules[1]);

    const withJump = updateRuleActions(rules, 0, (actions) => [
      ...actions,
      { id: "newjump00000000000000001", objective: "jumpToBlock", target: ids.endings.thanks },
    ]);
    expect(withJump[0].actions.map((action) => action.objective)).toEqual(["calculate", "jumpToBlock"]);
    expect(rules[0].actions).toHaveLength(1);
  });
});

describe("new rules from the Add logic menu", () => {
  const condition = {
    leftOperand: { type: "element" as const, value: "fav" },
    operator: "isSubmitted" as const,
  };

  test("a jump rule starts with one condition and an empty jump", () => {
    const rule = createRule("jump", { condition });

    expect(rule.conditions).toMatchObject({ connector: "and", conditions: [condition] });
    expect(rule.actions).toEqual([{ id: expect.any(String), objective: "jumpToBlock", target: "" }]);
  });

  test("a Mark as low quality rule starts with one condition and the action, which takes nothing else (ENG-6933)", () => {
    const rule = createRule("markLowQuality", { condition, variableId: ids.variables.score });

    expect(rule.conditions).toMatchObject({ connector: "and", conditions: [condition] });
    expect(rule.actions).toEqual([{ id: expect.any(String), objective: "markLowQuality" }]);
  });

  test("a calculation starts with the first computed field, set to a value", () => {
    const rule = createRule("calculate", { condition, variableId: ids.variables.score });

    expect(rule.actions).toEqual([
      {
        id: expect.any(String),
        objective: "calculate",
        variableId: ids.variables.score,
        operator: "assign",
        value: { type: "static", value: "" },
      },
    ]);
  });
});

describe("a block's rules on the survey", () => {
  test("setting a block's rules leaves the other blocks alone", () => {
    const survey = setBlockRules(surveyFlowFixture, 1, []);

    expect(survey.blocks[1].logic).toEqual([]);
    expect(survey.blocks[0]).toBe(surveyFlowFixture.blocks[0]);
    expect(surveyFlowFixture.blocks[1].logic).toHaveLength(1);
  });

  test("removing a block's last rule also removes its fallback, leaving no empty key behind", () => {
    const survey = setBlockRules(surveyFlowFixture, 4, []);

    expect("logicFallback" in survey.blocks[4]).toBe(false);
  });

  test("a fallback is set, and cleared back to the next block", () => {
    const set = setBlockLogicFallback(surveyFlowFixture, 0, ids.endings.notForYou);
    expect(set.blocks[0].logicFallback).toBe(ids.endings.notForYou);

    const cleared = setBlockLogicFallback(surveyFlowFixture, 4, undefined);
    expect("logicFallback" in cleared.blocks[4]).toBe(false);
  });

  test("an index outside the survey changes nothing", () => {
    expect(setBlockRules(surveyFlowFixture, 9, [])).toBe(surveyFlowFixture);
    expect(setBlockLogicFallback(surveyFlowFixture, -1, undefined)).toBe(surveyFlowFixture);
  });
});

describe("the rules before the first question (ENG-6932)", () => {
  const startRules = (): TSurveyBlockLogic[] => structuredClone(surveyFlowFixture.startLogic ?? []);

  test("are set on the survey, and removing the last one stores none, as a new survey has", () => {
    const one = setStartRules(surveyFlowFixture, startRules().slice(0, 1));
    expect(one.startLogic).toHaveLength(1);
    expect(one.blocks).toBe(surveyFlowFixture.blocks);

    expect(setStartRules(surveyFlowFixture, []).startLogic).toBeNull();
  });

  test("offer only a jump and a calculation; a block's rules also offer require answer and Mark as low quality", () => {
    expect(getAllowedActionObjectives(START_SCOPE_BLOCK_IDX)).toEqual(["calculate", "jumpToBlock"]);
    expect(getAllowedActionObjectives(0)).toEqual([
      "calculate",
      "requireAnswer",
      "jumpToBlock",
      "markLowQuality",
    ]);
  });

  test("a rule jumps once and marks Low quality once: other actions don't offer either again (ENG-6933)", () => {
    const actions = [
      { id: "a", objective: "jumpToBlock" as const, target: "" },
      { id: "b", objective: "markLowQuality" as const },
      { id: "c", objective: "requireAnswer" as const, target: "" },
    ];

    expect(getObjectivesForAction(actions, 0, 2)).toEqual(["calculate", "requireAnswer", "jumpToBlock"]);
    expect(getObjectivesForAction(actions, 1, 2)).toEqual(["calculate", "requireAnswer", "markLowQuality"]);
    expect(getObjectivesForAction(actions, 2, 2)).toEqual(["calculate", "requireAnswer"]);
    expect(getObjectivesForAction(actions.slice(0, 1), 0, START_SCOPE_BLOCK_IDX)).toEqual([
      "calculate",
      "jumpToBlock",
    ]);
  });

  test("an action added below a jump is a calculation before the first question, a require answer after a block", () => {
    const jump = [{ id: "a", objective: "jumpToBlock" as const, target: "" }];

    expect(getNextActionObjective(jump, START_SCOPE_BLOCK_IDX)).toBe("calculate");
    expect(getNextActionObjective(jump, 2)).toBe("requireAnswer");
    expect(getNextActionObjective([], START_SCOPE_BLOCK_IDX)).toBe("jumpToBlock");
  });

  test("a new condition reads the first URL parameter, as there is no answer yet", () => {
    expect(getDefaultStartCondition(surveyFlowFixture)).toEqual({
      leftOperand: { type: "hiddenField", value: ids.hiddenFields.panelId },
      operator: "isSet",
    });
  });

  test("without URL parameters, a new condition reads the page URL", () => {
    const survey: TSurvey = {
      ...surveyFlowFixture,
      embeddedFields: (surveyFlowFixture.embeddedFields ?? []).filter(
        (field) => field.field.source !== "ingested"
      ),
      hiddenFields: { enabled: true, fieldIds: [] },
    };

    expect(getDefaultStartCondition(survey)).toEqual({
      leftOperand: { type: "reserved", value: "url" },
      operator: "isSet",
    });
  });
});

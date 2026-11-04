import { describe, expect, test } from "vitest";
import type { TSurveyBlockLogicAction } from "@formbricks/types/surveys/blocks";
import type { TConditionGroup, TSingleCondition } from "@formbricks/types/surveys/logic";
import {
  SURVEY_FLOW_FIXTURE_IDS as ids,
  surveyFlowFixture,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import { describeAction, describeConditionGroup, describeRuleActions } from "./flow-outline-text";

// Every key reads as its last segment, so the operator labels below are the i18n keys' names.
const t = ((key: string, options?: { blockNumber?: number }) =>
  key === "workspace.surveys.edit.block_n" ? `Block ${options?.blockNumber}` : key.split(".").pop()) as never;

const rule = (blockIdx: number, ruleIdx: number) => surveyFlowFixture.blocks[blockIdx].logic![ruleIdx];

describe("describeConditionGroup", () => {
  test("names questions by code, options by label and fields by name", () => {
    expect(describeConditionGroup(rule(0, 0).conditions, surveyFlowFixture, t)).toBe(
      "“services” includes_one_of Apple TV+ and @panel_id is_set"
    );
  });

  test("puts a nested group in brackets and joins with its own connector", () => {
    expect(describeConditionGroup(rule(4, 1).conditions, surveyFlowFixture, t)).toBe(
      "“bundle” equals No bundle and (“apple_reason” is_skipped or “apple_reason” contains “price”)"
    );
  });

  test("names a matrix row and column instead of their positions", () => {
    expect(describeConditionGroup(rule(5, 0).conditions, surveyFlowFixture, t)).toContain(
      "“brand_grid” Netflix equals Good"
    );
  });

  test("names a matrix row and column by id after they were reordered (ADR 0027)", () => {
    // The stored positions are stale: rows and columns were reversed since the rule was written.
    const reordered = structuredClone(surveyFlowFixture);
    const grid = reordered.blocks
      .flatMap((block) => block.elements)
      .find((element) => element.id === "brand_grid") as { rows: unknown[]; columns: unknown[] };
    grid.rows.reverse();
    grid.columns.reverse();
    expect(describeConditionGroup(rule(5, 0).conditions, reordered, t)).toContain(
      "“brand_grid” Netflix equals Good"
    );
  });

  test("reads computed and reserved fields on either side", () => {
    expect(describeConditionGroup(rule(2, 0).conditions, surveyFlowFixture, t)).toBe(
      "“hours” >= 20 or tenure_days < “hours”"
    );
    expect(describeConditionGroup(rule(3, 2).conditions, surveyFlowFixture, t)).toBe(
      "language equals @seg and @seg does_not_equal country"
    );
  });

  test("an empty group always matches", () => {
    expect(describeConditionGroup({ id: "g", connector: "and", conditions: [] }, surveyFlowFixture, t)).toBe(
      "always"
    );
  });

  describe("dates read in the app's date format (P65)", () => {
    const group = (condition: Omit<TSingleCondition, "id">): TConditionGroup => ({
      id: "g",
      connector: "and",
      conditions: [{ id: "c", ...condition }],
    });

    test("a date question's calendar date reads as the day, in the viewer's locale", () => {
      const lapsed = rule(5, 0).conditions;
      expect(describeConditionGroup(lapsed, surveyFlowFixture, t)).toContain(
        "“last_purchase” is_before Jan 1, 2026"
      );
      expect(describeConditionGroup(lapsed, surveyFlowFixture, t, { locale: "en-GB" })).toContain(
        "“last_purchase” is_before 1 Jan 2026"
      );
    });

    test("a timestamp on a date field reads as the day plus the time, in the viewer's time zone", () => {
      const condition = group({
        leftOperand: { type: "variable", value: ids.variables.signedUpAt },
        operator: "isAfter",
        rightOperand: { type: "static", value: "2026-11-04T10:12:00.000Z" },
      });
      expect(
        describeConditionGroup(condition, surveyFlowFixture, t, { locale: "en-GB", timeZone: "UTC" })
      ).toBe("signed_up_at is_after 4 Nov 2026, 10:12");
    });

    test("a passed-in date field's value reads as a date too", () => {
      const condition = group({
        leftOperand: { type: "hiddenField", value: ids.hiddenFields.signupDate },
        operator: "isBefore",
        rightOperand: { type: "static", value: "2026-03-01" },
      });
      expect(describeConditionGroup(condition, surveyFlowFixture, t)).toBe(
        "@signup_date is_before Mar 1, 2026"
      );
    });

    test("text that looks like a date stays text when what it is compared with isn't a date", () => {
      const condition = group({
        leftOperand: { type: "hiddenField", value: ids.hiddenFields.panelId },
        operator: "equals",
        rightOperand: { type: "static", value: "2026-03-01" },
      });
      expect(describeConditionGroup(condition, surveyFlowFixture, t)).toBe("@panel_id equals “2026-03-01”");
    });
  });
});

describe("describeAction", () => {
  const action = (blockIdx: number, ruleIdx: number, actionIdx = 0) =>
    rule(blockIdx, ruleIdx).actions[actionIdx];

  test("a jump names its ending or block", () => {
    expect(describeAction(action(4, 1), surveyFlowFixture, t)).toEqual({
      kind: "jump",
      target: "ending",
      label: "Good to know bundles aren't for you",
    });
    expect(describeAction(action(4, 2), surveyFlowFixture, t)).toEqual({
      kind: "jump",
      target: "ending",
      label: "Internal test",
    });
    expect(describeAction(action(4, 3, 2), surveyFlowFixture, t)).toEqual({
      kind: "jump",
      target: "block",
      label: "Profile",
    });
  });

  test("a date set on a date field reads as that day (P65)", () => {
    const setDate: TSurveyBlockLogicAction = {
      id: "a",
      objective: "calculate",
      variableId: ids.variables.signedUpAt,
      operator: "assign",
      value: { type: "static", value: "2026-11-04" },
    };
    expect(describeAction(setDate, surveyFlowFixture, t, { locale: "en-GB" })).toEqual({
      kind: "calculate",
      label: "signed_up_at = 4 Nov 2026",
    });
  });

  test("a jump to a deleted or unset destination says so", () => {
    const jump: TSurveyBlockLogicAction = { id: "a", objective: "jumpToBlock", target: "gone" };
    expect(describeAction(jump, surveyFlowFixture, t)).toEqual({
      kind: "jump",
      target: "missing",
      label: "",
    });
  });

  test("require answer names the question", () => {
    expect(describeAction(action(0, 0), surveyFlowFixture, t)).toEqual({
      kind: "requireAnswer",
      label: "“apple_reason”",
    });
  });

  test("a calculation reads as field, operator and value", () => {
    expect(describeAction(action(0, 1), surveyFlowFixture, t).label).toBe("score + 1");
    expect(describeAction(action(1, 0), surveyFlowFixture, t).label).toBe("score + “sat_netflix”");
    expect(describeAction(action(2, 0), surveyFlowFixture, t).label).toBe("segment + “-heavy”");
    expect(describeAction(action(2, 0, 1), surveyFlowFixture, t).label).toBe("score − tenure_days");
    expect(describeAction(action(3, 0), surveyFlowFixture, t).label).toBe("score × 2");
    expect(describeAction(action(3, 1), surveyFlowFixture, t).label).toBe("score ÷ 2");
    expect(describeAction(action(3, 2), surveyFlowFixture, t).label).toBe("segment = @seg");
    expect(describeAction(action(4, 3), surveyFlowFixture, t).label).toBe("segment = “hot-lead”");
  });

  test("Mark as low quality reads as its own step, with nothing to name (ENG-6933)", () => {
    const markLowQuality: TSurveyBlockLogicAction = { id: "a", objective: "markLowQuality" };
    expect(describeAction(markLowQuality, surveyFlowFixture, t)).toEqual({
      kind: "markLowQuality",
      label: "",
    });
  });

  test("a Set value step reads as field = formula (ENG-6935)", () => {
    expect(describeAction(action(1, 1), surveyFlowFixture, t).label).toBe(
      "score = round(ifEmpty(@sat_netflix, 0) + ifEmpty(@sat_disney, 0) * 2, 1)"
    );
    expect(describeAction(action(5, 1, 0), surveyFlowFixture, t).label).toBe("signed_up_at = now()");
    expect(describeAction(action(5, 1, 1), surveyFlowFixture, t).label).toBe(
      "tenure_days = daysBetween(@signup_date, @signed_up_at)"
    );
  });

  test("a Set value with no field yet says a field is missing, not = “”", () => {
    const formula: TSurveyBlockLogicAction = {
      id: "a",
      objective: "calculate",
      variableId: "",
      operator: "assign",
      value: { type: "expression", value: { type: "static", value: "" } },
    };
    const oneStep: TSurveyBlockLogicAction = {
      id: "b",
      objective: "calculate",
      variableId: "",
      operator: "assign",
      value: { type: "static", value: "" },
    };
    expect(describeAction(formula, surveyFlowFixture, t)).toEqual({
      kind: "calculate",
      label: "no_field_to_set",
    });
    expect(describeAction(oneStep, surveyFlowFixture, t)).toEqual({
      kind: "calculate",
      label: "no_field_to_set",
    });
  });

  test("an action this editor doesn't know still reads as its objective", () => {
    const unknown = { id: "a", objective: "setOutcome" } as unknown as TSurveyBlockLogicAction;
    expect(describeAction(unknown, surveyFlowFixture, t)).toEqual({
      kind: "unknown",
      label: "setOutcome",
    });
  });
});

describe("describeRuleActions: a rule's actions read as separate steps", () => {
  test("steps after the first are set apart, and the jump comes last behind “then”", () => {
    // Two calculations, then a jump to the Profile block.
    expect(describeRuleActions(rule(4, 3).actions, surveyFlowFixture, t)).toEqual([
      { lead: "none", action: { kind: "calculate", label: "segment = “hot-lead”" } },
      { lead: "and", action: { kind: "calculate", label: "tenure_days = score" } },
      { lead: "then", action: { kind: "jump", target: "block", label: "Profile" } },
    ]);
  });

  test("a jump listed before the other actions still reads last, because it happens last", () => {
    const [first, second, jump] = rule(4, 3).actions;
    const steps = describeRuleActions([jump, first, second], surveyFlowFixture, t);

    expect(steps.map((step) => [step.lead, step.action.kind])).toEqual([
      ["none", "calculate"],
      ["and", "calculate"],
      ["then", "jump"],
    ]);
  });

  test("a rule that only jumps has no lead", () => {
    expect(describeRuleActions(rule(4, 1).actions, surveyFlowFixture, t)).toEqual([
      {
        lead: "none",
        action: {
          kind: "jump",
          target: "ending",
          label: "Good to know bundles aren't for you",
        },
      },
    ]);
  });
});

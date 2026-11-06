import { describe, expect, test } from "vitest";
import type { TSurveyBlockLogicAction } from "@formbricks/types/surveys/blocks";
import type { TConditionGroup, TSingleCondition } from "@formbricks/types/surveys/logic";
import {
  SURVEY_FLOW_FIXTURE_IDS as ids,
  surveyFlowFixture,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import {
  describeAction,
  describeBlockCounts,
  describeBlockShowIfParts,
  describeConditionGroup,
  describeConditionGroupParts,
  describeFirstStepParts,
  describeIfConditionParts,
  describeRuleCondition,
  describeRuleConditionParts,
  describeRuleSummary,
  summarizeRuleActions,
} from "./flow-outline-text";
import { type TFlowTextPart, toPlainText } from "./reference-chips";

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

  test("names a matrix row and column by id after they were reordered (ADR 0032)", () => {
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

describe("summarizeRuleActions: a rule row keeps to one line (ENG-6969 T2)", () => {
  test("the first action reads in full, the others fold into +N, and the jump is a trailing pill", () => {
    // Two calculations, then a jump to the Profile block.
    expect(summarizeRuleActions(rule(4, 3).actions, surveyFlowFixture, t)).toEqual({
      first: { kind: "calculate", label: "segment = “hot-lead”" },
      moreCount: 1,
      jump: { kind: "jump", target: "block", label: "Profile" },
    });
  });

  test("a jump listed before the other actions still trails, because it happens last", () => {
    const [first, second, jump] = rule(4, 3).actions;
    const summary = summarizeRuleActions([jump, first, second], surveyFlowFixture, t);

    expect(summary.first).toEqual({ kind: "calculate", label: "segment = “hot-lead”" });
    expect(summary.moreCount).toBe(1);
    expect(summary.jump).toEqual({ kind: "jump", target: "block", label: "Profile" });
  });

  test("a rule that only jumps is its pill alone", () => {
    expect(summarizeRuleActions(rule(4, 1).actions, surveyFlowFixture, t)).toEqual({
      moreCount: 0,
      jump: { kind: "jump", target: "ending", label: "Good to know bundles aren't for you" },
    });
  });

  test("without a jump every action after the first is counted", () => {
    const [first, second] = rule(4, 3).actions;
    expect(summarizeRuleActions([first, second, first], surveyFlowFixture, t)).toEqual({
      first: { kind: "calculate", label: "segment = “hot-lead”" },
      moreCount: 2,
    });
  });

  test("a second jump, written through the API, is counted rather than dropped", () => {
    const jump = rule(4, 3).actions[2];
    const summary = summarizeRuleActions([jump, jump], surveyFlowFixture, t);
    expect(summary.first).toBeUndefined();
    expect(summary.moreCount).toBe(1);
    expect(summary.jump?.label).toBe("Profile");
  });
});

describe("describeRuleSummary: the whole sentence, for the tooltip and the row's accessible name", () => {
  test("lists every action, with the destination last", () => {
    expect(describeRuleSummary(rule(4, 3), surveyFlowFixture, t)).toBe(
      "if “bundle” does_not_equal No bundle and score > tenure_days → segment = “hot-lead” · tenure_days = score → Profile"
    );
  });

  test("names what an action does when its text alone would not say it", () => {
    const requireAnswer = surveyFlowFixture.blocks
      .flatMap((block) => block.logic ?? [])
      .find((item) => item.actions.some((action) => action.objective === "requireAnswer"));
    expect(describeRuleSummary(requireAnswer!, surveyFlowFixture, t)).toMatch(/→ require_answer_to$/);

    const lowQuality = surveyFlowFixture.blocks
      .flatMap((block) => block.logic ?? [])
      .find((item) => item.id === ids.lowQuality.rule);
    expect(describeRuleSummary(lowQuality!, surveyFlowFixture, t)).toMatch(/→ mark_as_low_quality$/);
  });

  test("a rule without conditions always runs", () => {
    const always = { ...rule(4, 1), conditions: { id: "g", connector: "and" as const, conditions: [] } };
    expect(describeRuleSummary(always, surveyFlowFixture, t)).toBe(
      "always_runs → Good to know bundles aren't for you"
    );
  });
});

describe("references as chips in rule summaries (ENG-6969 T3)", () => {
  const chips = (parts: TFlowTextPart[]) =>
    parts.flatMap((part) => (part.kind === "reference" ? [part.chip] : []));
  const texts = (parts: TFlowTextPart[]) =>
    parts.flatMap((part) => (part.kind === "text" ? [part.text] : []));

  test("questions, hidden fields, Embedded Data and survey info are chips; typed values are quoted text", () => {
    const parts = describeConditionGroupParts(rule(3, 2).conditions, surveyFlowFixture, t);
    expect(chips(parts)).toEqual([
      { kind: "reserved", label: "language" },
      { kind: "hiddenField", label: "seg" },
      { kind: "hiddenField", label: "seg" },
      { kind: "reserved", label: "country" },
    ]);

    const condition = describeConditionGroupParts(rule(4, 1).conditions, surveyFlowFixture, t);
    expect(chips(condition)[0]).toEqual({
      kind: "question",
      label: "bundle",
      elementType: "multipleChoiceSingle",
    });
    // An option label stays plain; text typed into the rule is the only thing in quotes.
    expect(texts(condition).join("")).toContain("No bundle");
    expect(texts(condition).join("")).not.toContain("“No bundle”");
    expect(texts(condition).join("")).toContain("“price”");
  });

  test("the plain form of the parts is the sentence the tooltip, aria-label and tests read", () => {
    for (const [blockIdx, ruleIdx] of [
      [0, 0],
      [2, 0],
      [3, 2],
      [4, 1],
      [5, 0],
    ]) {
      const parts = describeRuleConditionParts(rule(blockIdx, ruleIdx), surveyFlowFixture, t);
      expect(toPlainText(parts)).toBe(describeRuleCondition(rule(blockIdx, ruleIdx), surveyFlowFixture, t));
    }
  });

  test("a reference to something deleted is a missing chip", () => {
    const gone: TConditionGroup = {
      id: "g",
      connector: "and",
      conditions: [
        { id: "c1", leftOperand: { type: "element", value: "gone_q" }, operator: "isSubmitted" },
        { id: "c2", leftOperand: { type: "variable", value: "gone_field" }, operator: "isSet" },
      ],
    };
    expect(chips(describeConditionGroupParts(gone, surveyFlowFixture, t))).toEqual([
      { kind: "question", label: "gone_q", missing: true },
      { kind: "field", label: "gone_field", missing: true },
    ]);
  });

  test("a Set value step: the field set and the formula's references are chips", () => {
    const parts = describeFirstStepParts(rule(1, 1).actions, surveyFlowFixture, t);
    expect(chips(parts)).toEqual([
      { kind: "field", label: "score" },
      { kind: "question", label: "sat_netflix", elementType: "rating" },
      { kind: "question", label: "sat_disney", elementType: "rating" },
    ]);
    expect(toPlainText(parts)).toBe(describeAction(rule(1, 1).actions[0], surveyFlowFixture, t).label);
  });

  test("a one-step calculation and Require answer, as chips in their sentence", () => {
    expect(chips(describeFirstStepParts(rule(1, 0).actions, surveyFlowFixture, t))).toEqual([
      { kind: "field", label: "score" },
      { kind: "question", label: "sat_netflix", elementType: "rating" },
    ]);
    const sentence = ((key: string, options?: { question?: string }) =>
      key.endsWith("require_answer_to") ? `Require an answer to ${options?.question}` : key) as never;
    const requireAnswer = describeFirstStepParts(rule(0, 0).actions, surveyFlowFixture, sentence);
    expect(requireAnswer).toEqual([
      { kind: "text", text: "Require an answer to " },
      {
        kind: "reference",
        chip: { kind: "question", label: "apple_reason", elementType: "openText" },
        plain: "“apple_reason”",
      },
    ]);
  });

  test("the first step skips the jump, which trails as a pill", () => {
    const jumpFirst = [rule(4, 3).actions[2], rule(4, 3).actions[0]];
    expect(toPlainText(describeFirstStepParts(jumpFirst, surveyFlowFixture, t))).toBe("segment = “hot-lead”");
    expect(describeFirstStepParts([rule(4, 3).actions[2]], surveyFlowFixture, t)).toEqual([]);
  });
});

describe("references as chips in show-if summaries (ENG-6969 T3)", () => {
  const chips = (parts: TFlowTextPart[]) =>
    parts.flatMap((part) => (part.kind === "reference" ? [part.chip] : []));
  const sentence = ((key: string, options?: { conditions?: string }) =>
    key.endsWith("show_block_if_chip")
      ? `Show block if ${options?.conditions}`
      : key.split(".").pop()) as never;
  const blockShowIf = surveyFlowFixture.blocks.find((block) => block.id === ids.blocks.heavyUsers)!.showIf!;
  const questionShowIf = surveyFlowFixture.blocks
    .flatMap((block) => block.elements)
    .find((element) => element.id === "apple_reason")!.showIf!;

  test("a block's chip: its sentence around the condition, the question a chip, option labels plain", () => {
    const parts = describeBlockShowIfParts(blockShowIf, surveyFlowFixture, sentence);
    expect(parts[0]).toEqual({ kind: "text", text: "Show block if " });
    expect(chips(parts)).toEqual([
      { kind: "question", label: "services", elementType: "multipleChoiceMulti" },
    ]);
    expect(toPlainText(parts)).toBe("Show block if “services” includes_all_of Netflix, Disney+, Prime Video");
  });

  test("a block's chip reads as its plain sentence for the aria-label", () => {
    expect(toPlainText(describeBlockShowIfParts(blockShowIf, surveyFlowFixture, sentence))).toBe(
      `Show block if ${describeConditionGroup(blockShowIf, surveyFlowFixture, sentence)}`
    );
  });

  test("an option's “Shown when” cell starts with If, its question a chip", () => {
    const parts = describeIfConditionParts(questionShowIf, surveyFlowFixture, t);
    expect(parts[0]).toEqual({ kind: "text", text: "if " });
    expect(chips(parts)).toEqual([{ kind: "question", label: "fav", elementType: "multipleChoiceSingle" }]);
    expect(toPlainText(parts)).toBe(`if ${describeConditionGroup(questionShowIf, surveyFlowFixture, t)}`);
  });

  test("a rule's condition starts the same way", () => {
    expect(describeRuleConditionParts(rule(4, 1), surveyFlowFixture, t)).toEqual(
      describeIfConditionParts(rule(4, 1).conditions, surveyFlowFixture, t)
    );
  });
});

describe("describeBlockCounts (ENG-6969 T15)", () => {
  const count = ((key: string, options?: { count?: number }) =>
    `${key.split(".").pop()}:${options?.count}`) as never;

  test("names the questions and the rules", () => {
    expect(describeBlockCounts({ elementCount: 4, ruleCount: 2 }, count)).toBe(
      "count_questions:4 · count_rules:2"
    );
  });

  test("leaves the rule count out when there are none", () => {
    expect(describeBlockCounts({ elementCount: 1, ruleCount: 0 }, count)).toBe("count_questions:1");
  });
});

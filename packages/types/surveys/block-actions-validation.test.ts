import { describe, expect, test } from "vitest";
import type { TSurveyBlockLogicAction } from "./blocks";
import {
  PRESELECT_ANSWER_MAX_CHOICES,
  PRESELECT_ANSWER_MAX_CHOICE_ID_LENGTH,
  PRESELECT_ANSWER_MAX_TEXT_LENGTH,
} from "./preselect-answer";
import { SURVEY_FLOW_FIXTURE_IDS, surveyFlowFixture } from "./test-fixtures/survey-flow-fixture";
import { type TSurvey, ZSurvey } from "./types";

/**
 * The checks every block rule's actions get on save (`validateBlockActions`): each refusal, at the
 * rule's path. Built on the shared fixture, with one rule on the Concept block (block 4).
 */

const ids = SURVEY_FLOW_FIXTURE_IDS;
const CONCEPT = 3;
const rulePath = ["blocks", CONCEPT, "logic", 0];

/** The fixture with the Concept block's rules replaced by one always-running rule. */
const withConceptActions = (
  actions: TSurveyBlockLogicAction[],
  update: (survey: TSurvey) => void = () => undefined
): TSurvey => {
  const survey = structuredClone(surveyFlowFixture);
  survey.blocks[CONCEPT].logic = [
    {
      id: "blockrule000000000000001",
      conditions: { id: "blockgroup00000000000001", connector: "and", conditions: [] },
      actions,
    },
  ];
  update(survey);
  return survey;
};

const issuesOf = (survey: TSurvey) =>
  (ZSurvey.safeParse(survey).error?.issues ?? []).map(({ path, message }) => ({ path, message }));

const expectIssue = (survey: TSurvey, path: PropertyKey[], message: string) => {
  expect(issuesOf(survey)).toContainEqual({ path, message: expect.stringContaining(message) as string });
};

const calculate = (
  variableId: string,
  operator: string,
  value: { type: string; value: string | number | boolean | object }
): TSurveyBlockLogicAction =>
  ({
    id: "blockaction0000000000001",
    objective: "calculate",
    variableId,
    operator,
    value,
  }) as TSurveyBlockLogicAction;

const requireAnswer = (target: string): TSurveyBlockLogicAction => ({
  id: "blockaction0000000000001",
  objective: "requireAnswer",
  target,
});

const jump = (target: string, id = "blockaction0000000000001"): TSurveyBlockLogicAction => ({
  id,
  objective: "jumpToBlock",
  target,
});

const preselect = (target: string, value: unknown): TSurveyBlockLogicAction =>
  ({
    id: "blockaction0000000000001",
    objective: "preselectAnswer",
    target,
    value,
  }) as TSurveyBlockLogicAction;

describe("block rule actions", () => {
  test("the rule used here is valid with a jump to an ending", () => {
    expect(issuesOf(withConceptActions([jump(ids.endings.thanks)]))).toEqual([]);
  });

  describe("Set value with a one-step operator", () => {
    test("refuses a computed field the survey doesn't have", () => {
      expectIssue(
        withConceptActions([calculate("missing", "assign", { type: "static", value: 1 })]),
        rulePath,
        "Variable ID missing does not exist in logic no: 1 of block 4"
      );
    });

    test("refuses a one-step operator on a computed date", () => {
      expectIssue(
        withConceptActions([calculate(ids.variables.signedUpAt, "assign", { type: "static", value: "x" })]),
        [...rulePath, "actions", 0, "value"],
        "A date field is set with an expression"
      );
    });

    test("refuses a computed field of the other type as the value", () => {
      expectIssue(
        withConceptActions([
          calculate(ids.variables.score, "add", { type: "variable", value: ids.variables.segment }),
        ]),
        rulePath,
        "Invalid variable type for variable"
      );
    });

    test("refuses an answer a text field can't take", () => {
      expectIssue(
        withConceptActions([
          calculate(ids.variables.segment, "assign", { type: "element", value: "services" }),
        ]),
        rulePath,
        "Invalid element type for text variable"
      );
    });

    test("refuses a text answer, or a missing one, for a number field", () => {
      expectIssue(
        withConceptActions([
          calculate(ids.variables.score, "add", { type: "element", value: "apple_reason" }),
        ]),
        rulePath,
        "Invalid element type for number variable"
      );
      expectIssue(
        withConceptActions([calculate(ids.variables.score, "add", { type: "element", value: "gone" })]),
        rulePath,
        "Invalid element type for number variable"
      );
    });
  });

  describe("Set value on a true/false field (ENG-6973)", () => {
    const QUALIFIED = "flowvarqualified00000001";
    const SOURCE_FLAG = "flowvarsourceflag0000001";
    const IS_PRO = "is_pro";
    const BOOLEAN_MESSAGE = "A true/false field is set to True, False or another true/false field";
    const valuePath = [...rulePath, "actions", 0, "value"];

    /** The fixture with a calculated true/false target, another one, and a passed-in one. */
    const withBooleanFields = (survey: TSurvey) => {
      const row = (storageKey: string, name: string, source: "computed" | "ingested") => ({
        field: { key: null, name, source, dataType: "boolean" as const, defaultValue: null, locked: false },
        link: { storageKey },
      });
      survey.embeddedFields = [
        ...(survey.embeddedFields ?? []),
        row(QUALIFIED, "qualified", "computed"),
        row(SOURCE_FLAG, "source_flag", "computed"),
        row(IS_PRO, "is_pro", "ingested"),
      ];
      survey.hiddenFields = {
        ...survey.hiddenFields,
        fieldIds: [...(survey.hiddenFields.fieldIds ?? []), IS_PRO],
      };
    };
    const booleanSurvey = (operator: string, value: Parameters<typeof calculate>[2]) =>
      withConceptActions([calculate(QUALIFIED, operator, value)], withBooleanFields);

    test.each([
      ["True", { type: "static", value: true }],
      ["False", { type: "static", value: false }],
      ["a calculated true/false field", { type: "variable", value: SOURCE_FLAG }],
      ["a passed-in true/false field", { type: "hiddenField", value: IS_PRO }],
    ])("accepts assigning %s", (_label, value) => {
      expect(issuesOf(booleanSurvey("assign", value))).toEqual([]);
    });

    test("refuses any operator but assign", () => {
      expectIssue(
        booleanSurvey("concat", { type: "hiddenField", value: IS_PRO }),
        valuePath,
        BOOLEAN_MESSAGE
      );
    });

    test.each([
      ["a text value", { type: "static", value: "true" }],
      ["a number", { type: "static", value: 1 }],
      ["a text field", { type: "variable", value: ids.variables.segment }],
      ["a passed-in text field", { type: "hiddenField", value: ids.hiddenFields.panelId }],
      ["a question", { type: "element", value: "services" }],
    ])("refuses %s as the value", (_label, value) => {
      expectIssue(booleanSurvey("assign", value), valuePath, BOOLEAN_MESSAGE);
    });

    test("refuses an expression", () => {
      expectIssue(
        booleanSurvey("assign", { type: "expression", value: { type: "static", value: "x" } }),
        valuePath,
        BOOLEAN_MESSAGE
      );
    });

    test("refuses True or False on a field of another type", () => {
      expectIssue(
        withConceptActions([calculate(ids.variables.segment, "assign", { type: "static", value: true })]),
        valuePath,
        "True or False can only be set on a true/false field"
      );
    });
  });

  describe("Require answer", () => {
    test("refuses a question that doesn't exist", () => {
      expectIssue(withConceptActions([requireAnswer("gone")]), rulePath, "Element ID gone does not exist");
    });

    test("refuses a question in the rule's own block", () => {
      expectIssue(withConceptActions([requireAnswer("concept")]), rulePath, "cannot be in the current block");
    });

    test("refuses a question in an earlier block", () => {
      expectIssue(withConceptActions([requireAnswer("hours")]), rulePath, "is in a previous block");
    });

    test("refuses a question that is already required", () => {
      const survey = withConceptActions([requireAnswer("csat")], (draft) => {
        const csat = draft.blocks[5].elements.find((element) => element.id === "csat");
        if (csat) csat.required = true;
      });

      expectIssue(survey, rulePath, "is already required");
    });
  });

  describe("Jump", () => {
    test("refuses a destination that no longer exists", () => {
      expectIssue(withConceptActions([jump("gone")]), rulePath, "Jump destination in rule 1");
    });

    test("refuses a jump to the rule's own block", () => {
      expectIssue(
        withConceptActions([jump(ids.blocks.concept)]),
        rulePath,
        "Cannot jump to the current block"
      );
    });

    test("refuses two jumps in one rule", () => {
      expectIssue(
        withConceptActions([
          jump(ids.endings.thanks),
          jump(ids.endings.noBundle, "blockaction0000000000002"),
        ]),
        ["blocks", CONCEPT, "logic"],
        "Multiple jump actions are not allowed"
      );
    });
  });
});

/** The fixed value of a condition: 0 is a value, only an empty text is missing. */
describe("a condition's fixed value", () => {
  const HEAVY_USERS = 2;
  const withHoursCondition = (value: string | number): TSurvey => {
    const survey = structuredClone(surveyFlowFixture);
    survey.blocks[HEAVY_USERS].logic = [
      {
        id: "blockrule000000000000001",
        conditions: {
          id: "blockgroup00000000000001",
          connector: "and",
          conditions: [
            {
              id: "blockcondition0000000001",
              leftOperand: { type: "element", value: "hours" },
              operator: "equals",
              rightOperand: { type: "static", value },
            },
          ],
        },
        actions: [jump(ids.endings.thanks)],
      },
    ];
    return survey;
  };

  test.each([0, "0"])("accepts %j, as validate does", (value) => {
    expect(issuesOf(withHoursCondition(value))).toEqual([]);
  });

  test("refuses an empty value", () => {
    expectIssue(
      withHoursCondition(""),
      ["blocks", HEAVY_USERS, "logic", 0, "conditions"],
      "Static value is required"
    );
  });

  // ENG-7437: Pre-select answer, on the Concept block (block 4); "fav" and "email" are in block 5.
  describe("Pre-select answer", () => {
    const actionPath = [...rulePath, "actions", 0];

    test("accepts an option of a later single select and a value in a later free text question", () => {
      expect(
        issuesOf(withConceptActions([preselect("fav", { type: "choices", choiceIds: ["prime"] })]))
      ).toEqual([]);
      expect(issuesOf(withConceptActions([preselect("email", { type: "static", value: "a@b.co" })]))).toEqual(
        []
      );
    });

    test("refuses a question in the rule's own block or an earlier one", () => {
      expectIssue(
        withConceptActions([preselect("concept", { type: "static", value: "x" })]),
        [...actionPath, "target"],
        "must target a question in a later block"
      );
      expectIssue(
        withConceptActions([preselect("services", { type: "choices", choiceIds: ["netflix"] })]),
        [...actionPath, "target"],
        "must target a question in a later block"
      );
    });

    test("refuses a question that doesn't exist", () => {
      expectIssue(
        withConceptActions([preselect("gone", { type: "static", value: "x" })]),
        [...actionPath, "target"],
        "Element ID gone does not exist"
      );
    });

    test("refuses an answer that doesn't fit the question, at its value", () => {
      expectIssue(
        withConceptActions([preselect("fav", { type: "choices", choiceIds: ["netflix", "prime"] })]),
        [...actionPath, "value"],
        "exactly one option"
      );
      expectIssue(
        withConceptActions([preselect("fav", { type: "choices", choiceIds: ["hbo"] })]),
        [...actionPath, "value"],
        "has no option hbo"
      );
    });

    // CODING_STANDARDS "Input Limits": each cap at its boundary.
    test("caps the options, an option id and a free text answer, and refuses a null character", () => {
      const ok = (value: unknown, target = "email") =>
        issuesOf(withConceptActions([preselect(target, value)])).filter(({ path }) =>
          String(path).includes("value")
        );
      const atCap = "x".repeat(PRESELECT_ANSWER_MAX_TEXT_LENGTH);

      expect(ok({ type: "static", value: atCap })).toEqual([]);
      expect(ok({ type: "static", value: `${atCap}x` })[0]?.message).toContain(
        `at most ${String(PRESELECT_ANSWER_MAX_TEXT_LENGTH)} characters`
      );
      expect(ok({ type: "static", value: "a\u0000b" })[0]?.message).toContain("null character");

      const ids = (count: number) => Array.from({ length: count }, (_, idx) => `o${String(idx)}`);
      const issuesFor = (choiceIds: string[]) =>
        issuesOf(withConceptActions([preselect("fav", { type: "choices", choiceIds })]));
      // At the cap the refinement looks the options up; one over, it names the limit.
      expect(issuesFor(ids(PRESELECT_ANSWER_MAX_CHOICES))).toContainEqual({
        path: [...actionPath, "value"],
        message: expect.stringContaining("exactly one option") as string,
      });
      expect(issuesFor(ids(PRESELECT_ANSWER_MAX_CHOICES + 1))).toEqual([
        {
          path: [...actionPath, "value"],
          message: `Conditional Logic: At most ${String(PRESELECT_ANSWER_MAX_CHOICES)} options can be pre-selected.`,
        },
      ]);
      const idOf = (length: number) => ["x".repeat(length)];
      expect(issuesFor(idOf(PRESELECT_ANSWER_MAX_CHOICE_ID_LENGTH)).map(({ path }) => path)).toEqual([
        [...actionPath, "value"],
      ]);
      expect(issuesFor(idOf(PRESELECT_ANSWER_MAX_CHOICE_ID_LENGTH + 1))).toContainEqual({
        path: [...actionPath, "value", "choiceIds", 0],
        message: `Conditional Logic: An option id has at most ${String(PRESELECT_ANSWER_MAX_CHOICE_ID_LENGTH)} characters`,
      });
    });

    test("refuses an empty answer and keys the value has no use for", () => {
      expectIssue(
        withConceptActions([preselect("fav", { type: "choices", choiceIds: [] })]),
        [...actionPath, "value", "choiceIds"],
        "Choose at least one option"
      );
      expectIssue(
        withConceptActions([preselect("email", { type: "static", value: "" })]),
        [...actionPath, "value", "value"],
        "Enter the answer to pre-select"
      );
      expect(
        issuesOf(withConceptActions([preselect("email", { type: "static", value: "x", label: "y" })])).length
      ).toBeGreaterThan(0);
    });
  });
});

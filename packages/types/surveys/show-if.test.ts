import { describe, expect, test } from "vitest";
import type { TConditionGroup } from "./logic";
import { getBlockVisibility, getOptionList, getOptionListKeys, isShownByShowIf } from "./show-if";
import { SURVEY_FLOW_FIXTURE_IDS as ids, surveyFlowFixture } from "./test-fixtures/survey-flow-fixture";
import { type TSurvey, ZSurvey } from "./types";

/**
 * Show-if (ENG-6931): the shared visibility rule, and the reference rule the survey validator
 * enforces with exact paths (json-shapes §1). The fixture's blocks, in order: 0 services
 * (`services`), 1 ratings (`sat_netflix`, `sat_disney`), 2 heavy users (`hours`), 3 concept
 * (`concept`), 4 overall (`fav`, `apple_reason`, `bundle`, `email`), 5 profile.
 */

const submitted = (elementId: string, suffix = "a") => ({
  id: `showifcond${suffix}`.padEnd(24, "0"),
  leftOperand: { type: "element" as const, value: elementId },
  operator: "isSubmitted" as const,
});

const answered = (elementId: string): TConditionGroup => ({
  id: "showifgroup0000000000001",
  connector: "and",
  conditions: [submitted(elementId)],
});

const withSurvey = (patch: (survey: TSurvey) => void): TSurvey => {
  const survey = structuredClone(surveyFlowFixture);
  patch(survey);
  return survey;
};

const showIfIssues = (survey: TSurvey) =>
  (ZSurvey.safeParse(survey).error?.issues ?? []).filter(
    (issue) => issue.path.includes("showIf") || issue.message.includes("show-if")
  );

describe("show-if in the fixture survey", () => {
  test("the fixture holds a block show-if and a question show-if, and stays valid", () => {
    expect(surveyFlowFixture.blocks.some((block) => block.showIf)).toBe(true);
    expect(surveyFlowFixture.blocks.some((block) => block.elements.some((element) => element.showIf))).toBe(
      true
    );
    expect(ZSurvey.safeParse(surveyFlowFixture).error?.issues ?? []).toEqual([]);
  });
});

describe("the show-if reference rule", () => {
  test("a block's show-if may use an earlier block", () => {
    const survey = withSurvey((draft) => {
      draft.blocks[3].showIf = answered("sat_disney");
    });

    expect(showIfIssues(survey)).toEqual([]);
  });

  test("a block's show-if may not use a question on its own block", () => {
    const survey = withSurvey((draft) => {
      draft.blocks[4].showIf = answered("fav");
    });

    expect(showIfIssues(survey).map((issue) => issue.path)).toEqual([
      ["blocks", 4, "showIf", "conditions", 0],
    ]);
  });

  test("a block's show-if may not use a later block", () => {
    const survey = withSurvey((draft) => {
      draft.blocks[1].showIf = answered("concept");
    });

    expect(showIfIssues(survey).map((issue) => issue.path)).toEqual([
      ["blocks", 1, "showIf", "conditions", 0],
    ]);
  });

  test("a question's show-if may use questions above it on its page and earlier blocks", () => {
    const survey = withSurvey((draft) => {
      draft.blocks[4].elements[2].showIf = {
        id: "showifgroup0000000000002",
        connector: "or",
        conditions: [submitted("fav", "a"), submitted("apple_reason", "b"), submitted("services", "c")],
      };
    });

    expect(showIfIssues(survey)).toEqual([]);
  });

  test("a question's show-if may not use itself", () => {
    const survey = withSurvey((draft) => {
      draft.blocks[4].elements[2].showIf = answered("bundle");
    });
    const issues = showIfIssues(survey);

    expect(issues.map((issue) => issue.path)).toEqual([
      ["blocks", 4, "elements", 2, "showIf", "conditions", 0],
    ]);
    expect(issues[0].message).toContain("itself");
  });

  test("a question's show-if may not use a question below it on its page", () => {
    const survey = withSurvey((draft) => {
      draft.blocks[4].elements[0].showIf = answered("email");
    });

    expect(showIfIssues(survey).map((issue) => issue.path)).toEqual([
      ["blocks", 4, "elements", 0, "showIf", "conditions", 0],
    ]);
  });

  test("a question's show-if may not use a later block", () => {
    const survey = withSurvey((draft) => {
      draft.blocks[1].elements[1].showIf = answered("hours");
    });

    expect(showIfIssues(survey).map((issue) => issue.path)).toEqual([
      ["blocks", 1, "elements", 1, "showIf", "conditions", 0],
    ]);
  });

  test("a violation inside a nested group points at the nested condition", () => {
    const survey = withSurvey((draft) => {
      draft.blocks[2].showIf = {
        id: "showifgroup0000000000003",
        connector: "and",
        conditions: [
          submitted("services", "a"),
          {
            id: "showifnested000000000001",
            connector: "or",
            conditions: [submitted("sat_netflix", "b"), submitted("hours", "c")],
          },
        ],
      };
    });

    expect(showIfIssues(survey).map((issue) => issue.path)).toEqual([
      ["blocks", 2, "showIf", "conditions", 1, "conditions", 1],
    ]);
  });

  test("an answer used as the right operand follows the rule too", () => {
    const survey = withSurvey((draft) => {
      draft.blocks[2].elements[0].showIf = {
        id: "showifgroup0000000000004",
        connector: "and",
        conditions: [
          {
            id: "showifrightoperand000001",
            leftOperand: { type: "variable", value: ids.variables.tenureDays },
            operator: "isLessThan",
            rightOperand: { type: "element", value: "hours" },
          },
        ],
      };
    });

    expect(showIfIssues(survey).map((issue) => issue.path)).toEqual([
      ["blocks", 2, "elements", 0, "showIf", "conditions", 0],
    ]);
  });

  test("the operand checks of logic apply: an unknown question and a wrong operator are refused", () => {
    const survey = withSurvey((draft) => {
      draft.blocks[3].showIf = answered("no_such_question");
      draft.blocks[4].elements[3].showIf = {
        id: "showifgroup0000000000005",
        connector: "and",
        conditions: [
          {
            id: "showifbadoperator0000001",
            leftOperand: { type: "element", value: "fav" },
            operator: "isGreaterThan",
            rightOperand: { type: "static", value: 3 },
          },
        ],
      };
    });
    const issues = showIfIssues(survey);

    expect(issues.map((issue) => issue.path)).toEqual([
      ["blocks", 3, "showIf"],
      ["blocks", 4, "elements", 3, "showIf"],
    ]);
    expect(issues[0].message).toContain("the show-if of block 4");
  });
});

describe("isShownByShowIf and getBlockVisibility", () => {
  const never = () => false;

  test("no show-if, or an empty group of either connector, is always shown", () => {
    expect(isShownByShowIf({}, never)).toBe(true);
    expect(isShownByShowIf({ showIf: { id: "g", connector: "or", conditions: [] } }, never)).toBe(true);
    expect(isShownByShowIf({ showIf: answered("fav") }, never)).toBe(false);
  });

  test("a block whose own show-if fails is skipped without evaluating its elements", () => {
    const visibility = getBlockVisibility(
      { showIf: answered("services"), elements: [{ id: "a" }] },
      { a: "kept" },
      never
    );

    expect(visibility).toEqual({
      shown: false,
      skipReason: "showIf",
      visibleElementIds: [],
      hiddenElementIds: [],
      optionsNotShown: {},
      data: { a: "kept" },
    });
  });

  test("a block with every element hidden is skipped as all hidden", () => {
    const visibility = getBlockVisibility(
      { elements: [{ id: "a", showIf: answered("x") }] },
      { a: "typed" },
      never
    );

    expect(visibility).toMatchObject({
      shown: false,
      skipReason: "allElementsHidden",
      hiddenElementIds: ["a"],
      data: {},
    });
  });
});

describe("option lists by element type (one table for every reader)", () => {
  test("choices for the choice types, rows and columns for a matrix, none for the rest", () => {
    expect(getOptionListKeys("multipleChoiceMulti")).toEqual(["choices"]);
    expect(getOptionListKeys("pictureSelection")).toEqual(["choices"]);
    expect(getOptionListKeys("matrix")).toEqual(["rows", "columns"]);
    expect(getOptionListKeys("openText")).toEqual([]);
  });

  test("getOptionList reads a list only where the type has it", () => {
    const choices = [{ id: "a" }];
    const ranking: { type: string } = { type: "ranking", choices } as { type: string };
    expect(getOptionList(ranking, "choices")).toBe(choices);
    // A stray key on a type without that list is not an option list.
    expect(getOptionList({ type: "openText", choices } as { type: string }, "choices")).toEqual([]);
    expect(getOptionList({ type: "matrix", choices } as { type: string }, "choices")).toEqual([]);
    expect(getOptionList(undefined, "rows")).toEqual([]);
  });
});

import { describe, expect, test, vi } from "vitest";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import {
  type TConditionGroup,
  type TSurveyLogicConditionsOperator,
  ZSurveyLogicConditionsOperator,
} from "@formbricks/types/surveys/logic";
import { advanceFromBlock, getPageVisibility } from "./block-flow";
import { evaluateLogic } from "./logic";

vi.mock("@/lib/i18n", () => ({
  getLocalizedValue: vi.fn((value, language) =>
    typeof value === "object" ? value[language] || value["default"] || "" : value
  ),
}));

/**
 * A condition on a question the respondent has not answered (P71, jobenjada review #26): false for
 * every operator except "is skipped" (and a CTA's "is not clicked"), and those two are true only once
 * the respondent passed the question without answering it. A question on the page being filled in is
 * not passed yet, so nothing on that page shows and then disappears as it is answered.
 */

const when = (elementId: string, operator: TSurveyLogicConditionsOperator, value?: string) =>
  ({
    id: `g-${elementId}-${operator}`,
    connector: "and",
    conditions: [
      {
        id: `c-${elementId}-${operator}`,
        leftOperand: { type: "element", value: elementId },
        operator,
        ...(value === undefined ? {} : { rightOperand: { type: "static", value } }),
      },
    ],
  }) as TConditionGroup;

const openText = (id: string, showIf?: TConditionGroup) => ({
  id,
  type: TSurveyElementTypeEnum.OpenText,
  headline: { default: id },
  required: false,
  inputType: "text",
  charLimit: { enabled: false },
  ...(showIf ? { showIf } : {}),
});

const makeSurvey = (blocks: Record<string, unknown>[]): TJsWorkspaceStateSurvey =>
  ({
    id: "survey1",
    name: "Survey",
    blocks,
    endings: [{ id: "end1", type: "endScreen", headline: { default: "end1" } }],
    variables: [],
    embeddedFields: [],
    welcomeCard: { enabled: false },
    languages: [],
  }) as unknown as TJsWorkspaceStateSurvey;

const ALL_OPERATORS = ZSurveyLogicConditionsOperator.options;
const TRUE_ONCE_PASSED: TSurveyLogicConditionsOperator[] = ["isSkipped", "isNotClicked"];

describe("a condition on a question passed without an answer", () => {
  const survey = makeSurvey([{ id: "b1", name: "b1", elements: [openText("q")] }]);

  test.each(ALL_OPERATORS)("%s", (operator) => {
    const result = evaluateLogic(survey, {}, {}, when("q", operator, "x"), "default");

    expect(result).toBe(TRUE_ONCE_PASSED.includes(operator));
  });

  test("an empty answer reads the same as no answer", () => {
    expect(evaluateLogic(survey, { q: "" }, {}, when("q", "doesNotEqual", "x"), "default")).toBe(false);
    expect(evaluateLogic(survey, { q: "" }, {}, when("q", "isSkipped"), "default")).toBe(true);
  });

  test("an answer is compared as before", () => {
    expect(evaluateLogic(survey, { q: "y" }, {}, when("q", "doesNotEqual", "x"), "default")).toBe(true);
    expect(evaluateLogic(survey, { q: "y" }, {}, when("q", "isSkipped"), "default")).toBe(false);
  });
});

describe("show-if on the page being filled in", () => {
  const visibleWith = (operator: TSurveyLogicConditionsOperator, responseData: Record<string, string>) =>
    getPageVisibility({
      survey: makeSurvey([
        {
          id: "b1",
          name: "b1",
          elements: [openText("fav"), openText("follow_up", when("fav", operator, "x"))],
        },
      ]),
      blockId: "b1",
      responseData,
      variables: {},
      selectedLanguage: "default",
      reservedFieldValues: {},
    }).visibleElementIds;

  test.each(ALL_OPERATORS)("%s on a question above it, not answered yet, hides it", (operator) => {
    expect(visibleWith(operator, {})).toEqual(["fav"]);
  });

  test('"does not equal" shows the follow-up only once the answer arrives and differs', () => {
    expect(visibleWith("doesNotEqual", {})).toEqual(["fav"]);
    expect(visibleWith("doesNotEqual", { fav: "y" })).toEqual(["fav", "follow_up"]);
    expect(visibleWith("doesNotEqual", { fav: "x" })).toEqual(["fav"]);
  });
});

describe("show-if on a later page, and rules, after the question was passed", () => {
  const survey = (operator: TSurveyLogicConditionsOperator) =>
    makeSurvey([
      {
        id: "b1",
        name: "b1",
        elements: [openText("fav")],
        logic: [
          {
            id: "r1",
            conditions: when("fav", operator, "x"),
            actions: [{ id: "a1", objective: "jumpToBlock", target: "end1" }],
          },
        ],
      },
      { id: "b2", name: "b2", elements: [openText("q2")], showIf: when("fav", operator, "x") },
      { id: "b3", name: "b3", elements: [openText("q3")] },
    ]);

  const advanceSkipping = (operator: TSurveyLogicConditionsOperator) =>
    advanceFromBlock({
      survey: survey(operator),
      blockId: "b1",
      responseData: {},
      submittedData: {},
      variables: {},
      selectedLanguage: "default",
      reservedFieldValues: {},
    });

  test('"is skipped" is true once the question was passed: its rule jumps', () => {
    expect(advanceSkipping("isSkipped").nextBlockId).toBe("end1");
  });

  test('"does not equal" on the skipped question is false: no jump, and the later block is not shown', () => {
    const result = advanceSkipping("doesNotEqual");

    expect(result.nextBlockId).toBe("b3");
    expect(result.skippedBlockIds).toEqual(["b2"]);
  });
});

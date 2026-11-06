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
 * A show-if on a question the respondent has not answered (P71, jobenjada review #26): false for every
 * operator except "is skipped" (and a CTA's "is not clicked"), and those two are true only once the
 * respondent passed the question without answering it. A question on the page being filled in is not
 * passed yet, so nothing on that page shows and then disappears as it is answered.
 *
 * Show-if only: rules and start logic read an unanswered question as they always have.
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

describe("after the question was passed without an answer", () => {
  // b1 asks "fav" and has a rule on it; b2 has a show-if on it.
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

  const skipBlock1 = (operator: TSurveyLogicConditionsOperator, withRule = true) => {
    const built = survey(operator);
    if (!withRule) built.blocks[0].logic = [];
    return advanceFromBlock({
      survey: built,
      blockId: "b1",
      responseData: {},
      submittedData: {},
      variables: {},
      selectedLanguage: "default",
      reservedFieldValues: {},
    });
  };

  test.each(ALL_OPERATORS)("a later block's show-if with %s", (operator) => {
    const result = skipBlock1(operator, false);
    const shown = TRUE_ONCE_PASSED.includes(operator);

    expect(result.nextBlockId).toBe(shown ? "b2" : "b3");
  });

  test('a rule with "does not equal X" still matches, as before: it jumps', () => {
    expect(skipBlock1("doesNotEqual").nextBlockId).toBe("end1");
  });

  test('a rule with "is skipped" matches', () => {
    expect(skipBlock1("isSkipped").nextBlockId).toBe("end1");
  });
});

describe("rules read an unanswered question as before", () => {
  const survey = makeSurvey([{ id: "b1", name: "b1", elements: [openText("q")] }]);

  test('"does not equal" and "is empty" match an empty answer', () => {
    expect(evaluateLogic(survey, {}, {}, when("q", "doesNotEqual", "x"), "default")).toBe(true);
    expect(evaluateLogic(survey, { q: "" }, {}, when("q", "isEmpty"), "default")).toBe(true);
  });
});

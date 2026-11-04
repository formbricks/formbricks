import { describe, expect, test } from "vitest";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import {
  type TConditionGroup,
  type TSurveyLogicConditionsOperator,
  ZSurveyLogicConditionsOperator,
} from "@formbricks/types/surveys/logic";
import { evaluateLogic } from "./utils";

/**
 * The server engine (quotas) reads a condition on an unanswered question as the renderer does (P71,
 * jobenjada review #26): false for every operator except "is skipped" and a CTA's "is not clicked". A
 * persisted response has passed every question it reports on.
 */

const when = (operator: TSurveyLogicConditionsOperator): TConditionGroup =>
  ({
    id: `g-${operator}`,
    connector: "and",
    conditions: [
      {
        id: `c-${operator}`,
        leftOperand: { type: "element", value: "q" },
        operator,
        rightOperand: { type: "static", value: "x" },
      },
    ],
  }) as TConditionGroup;

const survey = {
  id: "survey1",
  name: "Survey",
  blocks: [
    {
      id: "b1",
      name: "b1",
      elements: [
        {
          id: "q",
          type: TSurveyElementTypeEnum.OpenText,
          headline: { default: "q" },
          required: false,
          inputType: "text",
          charLimit: { enabled: false },
        },
      ],
    },
  ],
  endings: [],
  variables: [],
  embeddedFields: [],
  languages: [],
} as unknown as TJsWorkspaceStateSurvey;

const TRUE_WHEN_UNANSWERED: TSurveyLogicConditionsOperator[] = ["isSkipped", "isNotClicked"];

describe("a condition on a question the response left unanswered", () => {
  test.each(ZSurveyLogicConditionsOperator.options)("%s", (operator) => {
    expect(evaluateLogic(survey, {}, {}, when(operator), "default")).toBe(
      TRUE_WHEN_UNANSWERED.includes(operator)
    );
  });

  test("an empty answer reads the same as no answer", () => {
    expect(evaluateLogic(survey, { q: "" }, {}, when("doesNotEqual"), "default")).toBe(false);
    expect(evaluateLogic(survey, { q: "" }, {}, when("isSkipped"), "default")).toBe(true);
  });

  test("an answer is compared as before", () => {
    expect(evaluateLogic(survey, { q: "y" }, {}, when("doesNotEqual"), "default")).toBe(true);
  });
});

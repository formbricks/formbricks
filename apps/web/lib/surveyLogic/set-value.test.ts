import { describe, expect, test } from "vitest";
import type { TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { TSurveyBlockLogicAction } from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type { TExpression } from "@formbricks/types/surveys/expressions";
import { performActions } from "./utils";

/**
 * The server engine (quotas, summaries, follow-ups) evaluates Set value expressions through the same
 * shared evaluator as the survey bundle (ENG-6935, grill T8). The bundle's side is covered case by case
 * in `packages/surveys/src/lib/block-flow.set-value.test.ts`; this checks the server reaches the same
 * evaluator with the same inputs: answers, codes, fields, reserved values and the clearing "".
 */

const field = (
  storageKey: string,
  source: "computed" | "ingested",
  dataType: "number" | "string" | "date"
): TLinkedEmbeddedField => ({
  field: { key: null, name: storageKey, source, dataType, defaultValue: null, locked: false },
  link: { storageKey },
});

const survey = {
  id: "survey1",
  name: "Survey",
  blocks: [
    {
      id: "b1",
      name: "b1",
      elements: [
        { id: "rating", type: TSurveyElementTypeEnum.Rating, headline: { default: "r" }, required: false },
        {
          id: "plan",
          type: TSurveyElementTypeEnum.MultipleChoiceSingle,
          headline: { default: "p" },
          required: false,
          choices: [
            { id: "basic", label: { default: "Basic", de: "Einfach" }, code: "1" },
            { id: "premium", label: { default: "Premium", de: "Premium" }, code: "2" },
          ],
        },
      ],
    },
  ],
  endings: [],
  variables: [],
  embeddedFields: [
    field("score", "computed", "number"),
    field("label", "computed", "string"),
    field("visits", "ingested", "number"),
  ],
  languages: [],
} as unknown as TJsWorkspaceStateSurvey;

const setValue = (variableId: string, expression: TExpression): TSurveyBlockLogicAction => ({
  id: `action-${variableId}`,
  objective: "calculate",
  variableId,
  operator: "assign",
  value: { type: "expression", value: expression },
});

const call = (fn: string, ...args: TExpression[]) => ({ type: "call", fn, args }) as TExpression;

describe("performActions (server engine): Set value expressions", () => {
  test("computes the tree from answers and ingested fields", () => {
    const expression = call(
      "add",
      { type: "element", value: "rating" },
      call("multiply", { type: "hiddenField", value: "visits" }, { type: "static", value: 2 })
    );

    const { calculations } = performActions(
      survey,
      [setValue("score", expression)],
      {
        rating: 4,
        visits: "3",
      },
      {}
    );

    expect(calculations.score).toBe(10);
  });

  test("a single-select answer yields its answer code in the respondent's language", () => {
    const { calculations } = performActions(
      survey,
      [
        setValue(
          "label",
          call("concat", { type: "static", value: "plan-" }, { type: "element", value: "plan" })
        ),
      ],
      { plan: "Einfach" },
      {},
      { selectedLanguage: "de" }
    );

    expect(calculations.label).toBe("plan-1");
  });

  test("an empty result clears the field with an empty string", () => {
    const { calculations } = performActions(
      survey,
      [setValue("score", call("add", { type: "element", value: "rating" }, { type: "static", value: 1 }))],
      {},
      { score: 9 }
    );

    expect(calculations.score).toBe("");
  });

  test("a reserved leaf reads the reserved value map", () => {
    const { calculations } = performActions(
      survey,
      [setValue("label", { type: "reserved", value: "country" })],
      {},
      {},
      { embeddedValues: { country: "DE" } }
    );

    expect(calculations.label).toBe("DE");
  });
});

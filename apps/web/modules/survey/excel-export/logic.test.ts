import { createId } from "@paralleldrive/cuid2";
import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { TSurveyBlock, TSurveyBlockLogicAction } from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type {
  TConditionGroup,
  TSingleCondition,
  TSurveyLogicConditionsOperator,
} from "@formbricks/types/surveys/logic";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { createIcuTranslate } from "./__fixtures__/translate";
import { createLogicRenderer } from "./logic";

const VARIABLE_ID = createId();
const NEXT_BLOCK_ID = createId();
const EMPTY_BLOCK_ID = createId();
const THANKS_ENDING_ID = createId();
const REDIRECT_ENDING_ID = createId();
const UNTITLED_ENDING_ID = createId();

const element = (id: string, type: TSurveyElementTypeEnum, extra: Record<string, unknown> = {}) => ({
  id,
  type,
  headline: { default: `Headline of ${id}` },
  required: false,
  ...extra,
});

const BASE_BLOCK = {
  id: createId(),
  name: "Block 1",
  elements: [
    element("fruit", TSurveyElementTypeEnum.MultipleChoiceSingle, {
      choices: [
        { id: "apple", label: { default: "Apple", de: "Apfel" } },
        { id: "pear", label: { default: "<b>Pear</b>" } },
      ],
    }),
    element("toppings", TSurveyElementTypeEnum.MultipleChoiceMulti, {
      choices: [
        { id: "nuts", label: { default: "Nuts" } },
        { id: "cream", label: { default: "Cream" } },
        { id: "fudge", label: { default: "Fudge" } },
      ],
    }),
    element("score", TSurveyElementTypeEnum.NPS),
    element("comment", TSurveyElementTypeEnum.OpenText),
    element("grid", TSurveyElementTypeEnum.Matrix, {
      rows: [{ id: "row-price", label: { default: "Price" } }],
      columns: [
        { id: "col-bad", label: { default: "Bad" } },
        { id: "col-good", label: { default: "Good" } },
      ],
    }),
    element("pics", TSurveyElementTypeEnum.PictureSelection, {
      choices: [
        { id: "pic-a", imageUrl: "https://example.com/a.png" },
        { id: "pic-b", imageUrl: "https://example.com/b.png" },
      ],
    }),
    element("when", TSurveyElementTypeEnum.Date),
    element("terms", TSurveyElementTypeEnum.Consent),
    element("guide", TSurveyElementTypeEnum.CTA),
    element("meeting", TSurveyElementTypeEnum.Cal),
  ],
};

const SURVEY = {
  blocks: [
    BASE_BLOCK,
    { id: NEXT_BLOCK_ID, name: "Block 2", elements: [element("followup", TSurveyElementTypeEnum.OpenText)] },
    { id: EMPTY_BLOCK_ID, name: "Empty block", elements: [] },
  ],
  endings: [
    { id: THANKS_ENDING_ID, type: "endScreen", headline: { default: "<p>Thanks!</p>" } },
    { id: REDIRECT_ENDING_ID, type: "redirectToUrl", url: "https://example.com", label: "Website" },
    { id: UNTITLED_ENDING_ID, type: "endScreen" },
  ],
  embeddedFields: [
    {
      field: {
        key: null,
        name: "Total score",
        source: "computed",
        dataType: "number",
        defaultValue: 0,
        locked: false,
      },
      link: { storageKey: VARIABLE_ID },
    },
    {
      field: {
        key: "plan",
        name: "Plan",
        source: "ingested",
        dataType: "string",
        defaultValue: null,
        locked: false,
      },
      link: { storageKey: "plan" },
    },
  ],
} as unknown as TSurvey;

const t: TFunction = createIcuTranslate("en-US");

const jumpToNext: TSurveyBlockLogicAction = {
  id: createId(),
  objective: "jumpToBlock",
  target: NEXT_BLOCK_ID,
};

const blockWith = (
  logic: { conditions: TConditionGroup; actions: TSurveyBlockLogicAction[] }[],
  logicFallback?: string
): TSurveyBlock =>
  ({
    ...BASE_BLOCK,
    logic: logic.map((rule) => ({ id: createId(), ...rule })),
    logicFallback,
  }) as unknown as TSurveyBlock;

const render = (block: TSurveyBlock, locale = "en-US") =>
  createLogicRenderer({ survey: SURVEY, t, locale })(block);

const renderCondition = (condition: Omit<TSingleCondition, "id">) =>
  render(
    blockWith([
      {
        conditions: { id: createId(), connector: "and", conditions: [{ id: createId(), ...condition }] },
        actions: [jumpToNext],
      },
    ])
  );

const onElement = (value: string, meta?: Record<string, string>) =>
  ({ type: "element", value, ...(meta ? { meta } : {}) }) as const;

describe("createLogicRenderer: conditions", () => {
  test.each<[TSurveyLogicConditionsOperator, Omit<TSingleCondition, "id" | "operator">, string]>([
    [
      "equals",
      { leftOperand: onElement("fruit"), rightOperand: { type: "static", value: "apple" } },
      "question fruit equals “Apple”",
    ],
    [
      "doesNotEqual",
      { leftOperand: onElement("fruit"), rightOperand: { type: "static", value: "pear" } },
      "question fruit does not equal “Pear”",
    ],
    [
      "contains",
      { leftOperand: onElement("comment"), rightOperand: { type: "static", value: "bug" } },
      "question comment contains “bug”",
    ],
    [
      "doesNotContain",
      { leftOperand: onElement("comment"), rightOperand: { type: "static", value: "bug" } },
      "question comment does not contain “bug”",
    ],
    [
      "startsWith",
      { leftOperand: onElement("comment"), rightOperand: { type: "static", value: "Hi" } },
      "question comment starts with “Hi”",
    ],
    [
      "doesNotStartWith",
      { leftOperand: onElement("comment"), rightOperand: { type: "static", value: "Hi" } },
      "question comment does not start with “Hi”",
    ],
    [
      "endsWith",
      { leftOperand: onElement("comment"), rightOperand: { type: "static", value: "!" } },
      "question comment ends with “!”",
    ],
    [
      "doesNotEndWith",
      { leftOperand: onElement("comment"), rightOperand: { type: "static", value: "!" } },
      "question comment does not end with “!”",
    ],
    ["isSubmitted", { leftOperand: onElement("comment") }, "question comment is submitted"],
    ["isSkipped", { leftOperand: onElement("comment") }, "question comment is skipped"],
    [
      "isGreaterThan",
      { leftOperand: onElement("score"), rightOperand: { type: "static", value: 8 } },
      "question score is greater than 8",
    ],
    [
      "isLessThan",
      { leftOperand: onElement("score"), rightOperand: { type: "static", value: 7 } },
      "question score is less than 7",
    ],
    [
      "isGreaterThanOrEqual",
      { leftOperand: onElement("score"), rightOperand: { type: "static", value: 9 } },
      "question score is greater than or equal to 9",
    ],
    [
      "isLessThanOrEqual",
      { leftOperand: onElement("score"), rightOperand: { type: "static", value: 6 } },
      "question score is less than or equal to 6",
    ],
    [
      "equalsOneOf",
      { leftOperand: onElement("fruit"), rightOperand: { type: "static", value: ["apple", "pear"] } },
      "question fruit equals one of “Apple”, “Pear”",
    ],
    [
      "includesAllOf",
      { leftOperand: onElement("toppings"), rightOperand: { type: "static", value: ["nuts", "cream"] } },
      "question toppings includes all of “Nuts”, “Cream”",
    ],
    [
      "includesOneOf",
      { leftOperand: onElement("toppings"), rightOperand: { type: "static", value: ["fudge"] } },
      "question toppings includes one of “Fudge”",
    ],
    [
      "doesNotIncludeOneOf",
      { leftOperand: onElement("toppings"), rightOperand: { type: "static", value: ["nuts", "fudge"] } },
      "question toppings includes none of “Nuts”, “Fudge”",
    ],
    [
      "doesNotIncludeAllOf",
      { leftOperand: onElement("toppings"), rightOperand: { type: "static", value: ["nuts", "cream"] } },
      "question toppings does not include all of “Nuts”, “Cream”",
    ],
    ["isClicked", { leftOperand: onElement("guide") }, "question guide is clicked"],
    ["isNotClicked", { leftOperand: onElement("guide") }, "question guide is not clicked"],
    ["isAccepted", { leftOperand: onElement("terms") }, "question terms is accepted"],
    [
      "isBefore",
      { leftOperand: onElement("when"), rightOperand: { type: "static", value: "2026-12-24" } },
      "question when is before “2026-12-24”",
    ],
    [
      "isAfter",
      { leftOperand: onElement("when"), rightOperand: { type: "static", value: "2026-01-01" } },
      "question when is after “2026-01-01”",
    ],
    ["isBooked", { leftOperand: onElement("meeting") }, "question meeting is booked"],
    ["isPartiallySubmitted", { leftOperand: onElement("grid") }, "question grid is partially submitted"],
    ["isCompletelySubmitted", { leftOperand: onElement("grid") }, "question grid is completely submitted"],
    ["isSet", { leftOperand: { type: "reserved", value: "country" } }, "Country is set"],
    ["isNotSet", { leftOperand: { type: "hiddenField", value: "plan" } }, "hidden field Plan is not set"],
    ["isEmpty", { leftOperand: { type: "variable", value: VARIABLE_ID } }, "variable Total score is empty"],
    ["isNotEmpty", { leftOperand: { type: "hiddenField", value: "plan" } }, "hidden field Plan is not empty"],
    [
      "isAnyOf",
      {
        leftOperand: { type: "hiddenField", value: "plan" },
        rightOperand: { type: "static", value: ["pro", "team"] },
      },
      "hidden field Plan is one of “pro”, “team”",
    ],
  ])("states %s in plain words", (operator, operands, phrase) => {
    expect(renderCondition({ operator, ...operands } as Omit<TSingleCondition, "id">)).toBe(
      `If ${phrase}, then jump to question followup.`
    );
  });

  test("names a matrix row and its column by their labels, a picture by its position", () => {
    expect(
      renderCondition({
        leftOperand: onElement("grid", { row: "0" }),
        operator: "equals",
        rightOperand: { type: "static", value: "1" },
      })
    ).toBe("If question grid, row “Price” equals “Good”, then jump to question followup.");
    expect(
      renderCondition({
        leftOperand: onElement("pics"),
        operator: "includesOneOf",
        rightOperand: { type: "static", value: ["pic-b"] },
      })
    ).toBe("If question pics includes one of “Picture 2”, then jump to question followup.");
  });

  test("compares against another question or field when the right side is one", () => {
    expect(
      renderCondition({
        leftOperand: onElement("score"),
        operator: "isGreaterThan",
        rightOperand: { type: "variable", value: VARIABLE_ID },
      })
    ).toBe("If question score is greater than variable Total score, then jump to question followup.");
    expect(
      renderCondition({
        leftOperand: onElement("comment"),
        operator: "equals",
        rightOperand: { type: "element", value: "fruit" },
      })
    ).toBe("If question comment equals question fruit, then jump to question followup.");
  });

  test("shows what the survey no longer has by its stored id instead of dropping it", () => {
    expect(
      renderCondition({
        leftOperand: onElement("fruit"),
        operator: "equals",
        rightOperand: { type: "static", value: "banana" },
      })
    ).toBe("If question fruit equals “banana”, then jump to question followup.");
    expect(renderCondition({ leftOperand: onElement("deleted"), operator: "isSubmitted" })).toBe(
      "If question deleted is submitted, then jump to question followup."
    );
  });

  test("joins conditions with their connector and puts nested groups of several in parentheses", () => {
    const isSubmitted = (id: string): TSingleCondition => ({
      id: createId(),
      leftOperand: onElement(id),
      operator: "isSubmitted",
    });

    expect(
      render(
        blockWith([
          {
            conditions: {
              id: createId(),
              connector: "and",
              conditions: [
                isSubmitted("fruit"),
                {
                  id: createId(),
                  connector: "or",
                  conditions: [isSubmitted("score"), isSubmitted("comment")],
                },
                { id: createId(), connector: "or", conditions: [isSubmitted("when")] },
              ],
            },
            actions: [jumpToNext],
          },
        ])
      )
    ).toBe(
      "If question fruit is submitted and (question score is submitted or question comment is submitted) and question when is submitted, then jump to question followup."
    );
  });

  test("states a rule without conditions as always applying", () => {
    expect(
      render(
        blockWith([
          { conditions: { id: createId(), connector: "and", conditions: [] }, actions: [jumpToNext] },
        ])
      )
    ).toBe("Always jump to question followup.");
  });
});

describe("createLogicRenderer: actions and fallback", () => {
  const always: TConditionGroup = {
    id: createId(),
    connector: "and",
    conditions: [{ id: createId(), leftOperand: onElement("score"), operator: "isSubmitted" }],
  };

  test("states every action of a rule, joined as a list", () => {
    expect(
      render(
        blockWith([
          {
            conditions: always,
            actions: [
              { id: createId(), objective: "requireAnswer", target: "comment" },
              {
                id: createId(),
                objective: "calculate",
                variableId: VARIABLE_ID,
                operator: "add",
                value: { type: "static", value: 10 },
              },
              jumpToNext,
            ],
          },
        ])
      )
    ).toBe(
      "If question score is submitted, then require an answer to question comment, add 10 to Total score, and jump to question followup."
    );
  });

  test.each<[string, TSurveyBlockLogicAction, string]>([
    [
      "assign",
      {
        id: "a",
        objective: "calculate",
        variableId: VARIABLE_ID,
        operator: "assign",
        value: { type: "element", value: "score" },
      },
      "set Total score to question score",
    ],
    [
      "concat",
      {
        id: "a",
        objective: "calculate",
        variableId: VARIABLE_ID,
        operator: "concat",
        value: { type: "static", value: "!" },
      },
      "append “!” to Total score",
    ],
    [
      "subtract",
      {
        id: "a",
        objective: "calculate",
        variableId: VARIABLE_ID,
        operator: "subtract",
        value: { type: "static", value: 1 },
      },
      "subtract 1 from Total score",
    ],
    [
      "multiply",
      {
        id: "a",
        objective: "calculate",
        variableId: VARIABLE_ID,
        operator: "multiply",
        value: { type: "static", value: 2 },
      },
      "multiply Total score by 2",
    ],
    [
      "divide",
      {
        id: "a",
        objective: "calculate",
        variableId: VARIABLE_ID,
        operator: "divide",
        value: { type: "hiddenField", value: "plan" },
      },
      "divide Total score by hidden field Plan",
    ],
    [
      "a jump to an ending",
      { id: "a", objective: "jumpToBlock", target: THANKS_ENDING_ID },
      "jump to the ending “Thanks!”",
    ],
    [
      "a jump to a redirect",
      { id: "a", objective: "jumpToBlock", target: REDIRECT_ENDING_ID },
      "jump to the ending “Website”",
    ],
    [
      "a jump to an untitled ending",
      { id: "a", objective: "jumpToBlock", target: UNTITLED_ENDING_ID },
      "jump to ending 3",
    ],
    [
      "a jump to a block without questions",
      { id: "a", objective: "jumpToBlock", target: EMPTY_BLOCK_ID },
      "jump to block “Empty block”",
    ],
  ])("states %s", (_case, action, phrase) => {
    expect(render(blockWith([{ conditions: always, actions: [action] }]))).toBe(
      `If question score is submitted, then ${phrase}.`
    );
  });

  test("puts one rule on each line, then the fallback", () => {
    expect(
      render(
        blockWith(
          [
            { conditions: always, actions: [jumpToNext] },
            {
              conditions: always,
              actions: [{ id: createId(), objective: "jumpToBlock", target: THANKS_ENDING_ID }],
            },
          ],
          THANKS_ENDING_ID
        )
      )
    ).toBe(
      [
        "If question score is submitted, then jump to question followup.",
        "If question score is submitted, then jump to the ending “Thanks!”.",
        "Otherwise, jump to the ending “Thanks!”.",
      ].join("\n")
    );
  });

  test("is empty for a block without logic", () => {
    expect(render({ ...BASE_BLOCK } as unknown as TSurveyBlock)).toBe("");
  });

  test("lists a rule's actions the way the exporting user's locale lists things", () => {
    // The sentences come from `t`, already the user's; the list of actions is joined in their locale.
    const sentence = createLogicRenderer({ survey: SURVEY, t, locale: "de-DE" })(
      blockWith([
        {
          conditions: always,
          actions: [{ id: createId(), objective: "requireAnswer", target: "comment" }, jumpToNext],
        },
      ])
    );

    expect(sentence).toBe(
      "If question score is submitted, then require an answer to question comment und jump to question followup."
    );
  });
});

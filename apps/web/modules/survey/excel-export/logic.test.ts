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
      "question “Headline of fruit” equals “Apple”",
    ],
    [
      "doesNotEqual",
      { leftOperand: onElement("fruit"), rightOperand: { type: "static", value: "pear" } },
      "question “Headline of fruit” does not equal “Pear”",
    ],
    [
      "contains",
      { leftOperand: onElement("comment"), rightOperand: { type: "static", value: "bug" } },
      "question “Headline of comment” contains “bug”",
    ],
    [
      "doesNotContain",
      { leftOperand: onElement("comment"), rightOperand: { type: "static", value: "bug" } },
      "question “Headline of comment” does not contain “bug”",
    ],
    [
      "startsWith",
      { leftOperand: onElement("comment"), rightOperand: { type: "static", value: "Hi" } },
      "question “Headline of comment” starts with “Hi”",
    ],
    [
      "doesNotStartWith",
      { leftOperand: onElement("comment"), rightOperand: { type: "static", value: "Hi" } },
      "question “Headline of comment” does not start with “Hi”",
    ],
    [
      "endsWith",
      { leftOperand: onElement("comment"), rightOperand: { type: "static", value: "!" } },
      "question “Headline of comment” ends with “!”",
    ],
    [
      "doesNotEndWith",
      { leftOperand: onElement("comment"), rightOperand: { type: "static", value: "!" } },
      "question “Headline of comment” does not end with “!”",
    ],
    ["isSubmitted", { leftOperand: onElement("comment") }, "question “Headline of comment” is submitted"],
    ["isSkipped", { leftOperand: onElement("comment") }, "question “Headline of comment” is skipped"],
    [
      "isGreaterThan",
      { leftOperand: onElement("score"), rightOperand: { type: "static", value: 8 } },
      "question “Headline of score” is greater than 8",
    ],
    [
      "isLessThan",
      { leftOperand: onElement("score"), rightOperand: { type: "static", value: 7 } },
      "question “Headline of score” is less than 7",
    ],
    [
      "isGreaterThanOrEqual",
      { leftOperand: onElement("score"), rightOperand: { type: "static", value: 9 } },
      "question “Headline of score” is greater than or equal to 9",
    ],
    [
      "isLessThanOrEqual",
      { leftOperand: onElement("score"), rightOperand: { type: "static", value: 6 } },
      "question “Headline of score” is less than or equal to 6",
    ],
    [
      "equalsOneOf",
      { leftOperand: onElement("fruit"), rightOperand: { type: "static", value: ["apple", "pear"] } },
      "question “Headline of fruit” equals one of “Apple”, “Pear”",
    ],
    [
      "includesAllOf",
      { leftOperand: onElement("toppings"), rightOperand: { type: "static", value: ["nuts", "cream"] } },
      "question “Headline of toppings” includes all of “Nuts”, “Cream”",
    ],
    [
      "includesOneOf",
      { leftOperand: onElement("toppings"), rightOperand: { type: "static", value: ["fudge"] } },
      "question “Headline of toppings” includes one of “Fudge”",
    ],
    [
      "doesNotIncludeOneOf",
      { leftOperand: onElement("toppings"), rightOperand: { type: "static", value: ["nuts", "fudge"] } },
      "question “Headline of toppings” includes none of “Nuts”, “Fudge”",
    ],
    [
      "doesNotIncludeAllOf",
      { leftOperand: onElement("toppings"), rightOperand: { type: "static", value: ["nuts", "cream"] } },
      "question “Headline of toppings” does not include all of “Nuts”, “Cream”",
    ],
    ["isClicked", { leftOperand: onElement("guide") }, "question “Headline of guide” is clicked"],
    ["isNotClicked", { leftOperand: onElement("guide") }, "question “Headline of guide” is not clicked"],
    ["isAccepted", { leftOperand: onElement("terms") }, "question “Headline of terms” is accepted"],
    [
      "isBefore",
      { leftOperand: onElement("when"), rightOperand: { type: "static", value: "2026-12-24" } },
      "question “Headline of when” is before “2026-12-24”",
    ],
    [
      "isAfter",
      { leftOperand: onElement("when"), rightOperand: { type: "static", value: "2026-01-01" } },
      "question “Headline of when” is after “2026-01-01”",
    ],
    ["isBooked", { leftOperand: onElement("meeting") }, "question “Headline of meeting” is booked"],
    [
      "isPartiallySubmitted",
      { leftOperand: onElement("grid") },
      "question “Headline of grid” is partially submitted",
    ],
    [
      "isCompletelySubmitted",
      { leftOperand: onElement("grid") },
      "question “Headline of grid” is completely submitted",
    ],
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
      `If ${phrase}, then jump to question “Headline of followup”.`
    );
  });

  test("names a matrix row and its column by their labels, a picture by its position", () => {
    expect(
      renderCondition({
        leftOperand: onElement("grid", { row: "0" }),
        operator: "equals",
        rightOperand: { type: "static", value: "1" },
      })
    ).toBe(
      "If question “Headline of grid”, row “Price” equals “Good”, then jump to question “Headline of followup”."
    );
    expect(
      renderCondition({
        leftOperand: onElement("pics"),
        operator: "includesOneOf",
        rightOperand: { type: "static", value: ["pic-b"] },
      })
    ).toBe(
      "If question “Headline of pics” includes one of “Picture 2”, then jump to question “Headline of followup”."
    );
  });

  test("compares against another question or field when the right side is one", () => {
    expect(
      renderCondition({
        leftOperand: onElement("score"),
        operator: "isGreaterThan",
        rightOperand: { type: "variable", value: VARIABLE_ID },
      })
    ).toBe(
      "If question “Headline of score” is greater than variable Total score, then jump to question “Headline of followup”."
    );
    expect(
      renderCondition({
        leftOperand: onElement("comment"),
        operator: "equals",
        rightOperand: { type: "element", value: "fruit" },
      })
    ).toBe(
      "If question “Headline of comment” equals question “Headline of fruit”, then jump to question “Headline of followup”."
    );
  });

  test("shows what the survey no longer has by its stored id instead of dropping it", () => {
    expect(
      renderCondition({
        leftOperand: onElement("fruit"),
        operator: "equals",
        rightOperand: { type: "static", value: "banana" },
      })
    ).toBe("If question “Headline of fruit” equals “banana”, then jump to question “Headline of followup”.");
    expect(renderCondition({ leftOperand: onElement("deleted"), operator: "isSubmitted" })).toBe(
      "If question deleted is submitted, then jump to question “Headline of followup”."
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
      "If question “Headline of fruit” is submitted and (question “Headline of score” is submitted or question “Headline of comment” is submitted) and question “Headline of when” is submitted, then jump to question “Headline of followup”."
    );
  });

  test("states a rule without conditions as always applying", () => {
    expect(
      render(
        blockWith([
          { conditions: { id: createId(), connector: "and", conditions: [] }, actions: [jumpToNext] },
        ])
      )
    ).toBe("Always jump to question “Headline of followup”.");
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
      "If question “Headline of score” is submitted, then require an answer to question “Headline of comment”, add 10 to Total score, and jump to question “Headline of followup”."
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
      "set Total score to question “Headline of score”",
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
      `If question “Headline of score” is submitted, then ${phrase}.`
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
        "If question “Headline of score” is submitted, then jump to question “Headline of followup”.",
        "If question “Headline of score” is submitted, then jump to the ending “Thanks!”.",
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
      "If question “Headline of score” is submitted, then require an answer to question “Headline of comment” und jump to question “Headline of followup”."
    );
  });
});

describe("createLogicRenderer: how a rule names a question", () => {
  const ruleOn = (elementId: string): TSurveyBlock =>
    ({
      id: createId(),
      name: "Block",
      elements: [],
      logic: [
        {
          id: createId(),
          conditions: {
            id: createId(),
            connector: "and",
            conditions: [
              {
                id: createId(),
                leftOperand: { type: "element", value: elementId },
                operator: "isSubmitted",
              },
            ],
          },
          actions: [{ id: createId(), objective: "requireAnswer", target: elementId }],
        },
      ],
    }) as unknown as TSurveyBlock;

  const renderWith = (headlines: Record<string, string>, elementId: string) => {
    const survey = {
      ...SURVEY,
      blocks: [
        {
          id: createId(),
          name: "Block",
          elements: Object.entries(headlines).map(([id, headline]) =>
            element(id, TSurveyElementTypeEnum.OpenText, { headline: { default: headline } })
          ),
        },
      ],
    } as unknown as TSurvey;
    return createLogicRenderer({ survey, t, locale: "en-US" })(ruleOn(elementId));
  };

  test("by its headline as the reader sees it: markup gone, on one line", () => {
    expect(renderWith({ q1: "<p>How did you\n  hear <b>about</b> us?</p>" }, "q1")).toBe(
      "If question “How did you hear about us?” is submitted, then require an answer to question “How did you hear about us?”."
    );
  });

  test("a matrix row of a question named by its id stays named by its id", () => {
    const survey = {
      ...SURVEY,
      blocks: [
        {
          id: createId(),
          name: "Block",
          elements: [
            element("m", TSurveyElementTypeEnum.Matrix, {
              headline: { default: "" },
              rows: [{ id: "r", label: { default: "Price" } }],
              columns: [{ id: "c", label: { default: "Good" } }],
            }),
          ],
        },
      ],
    } as unknown as TSurvey;
    const block = {
      id: createId(),
      name: "Block",
      elements: [],
      logic: [
        {
          id: createId(),
          conditions: {
            id: createId(),
            connector: "and",
            conditions: [
              {
                id: createId(),
                leftOperand: { type: "element", value: "m", meta: { row: "0" } },
                operator: "isSubmitted",
              },
            ],
          },
          actions: [{ id: createId(), objective: "requireAnswer", target: "m" }],
        },
      ],
    } as unknown as TSurveyBlock;

    expect(createLogicRenderer({ survey, t, locale: "en-US" })(block)).toBe(
      "If question m, row “Price” is submitted, then require an answer to question m."
    );
  });

  test("cut after a word, the ellipsis not after a space", () => {
    // The 59th character is a space: the label ends on the word before it.
    const headline = `${"c".repeat(58)} ${"d".repeat(20)}`;

    expect(renderWith({ q1: headline }, "q1")).toContain(`question “${"c".repeat(58)}…”`);
  });

  test("cut to 60 characters, with an ellipsis", () => {
    const headline = `${"a".repeat(70)} end`;

    expect(renderWith({ q1: headline }, "q1")).toContain(`question “${"a".repeat(59)}…”`);
  });

  test.each([
    ["is empty", { q1: "<p> </p>", q2: "Other" }],
    ["reads the same as another's", { q1: "Why?", q2: "Why?" }],
    [
      "reads the same as another's once cut",
      { q1: `${"b".repeat(60)} first`, q2: `${"b".repeat(60)} second` },
    ],
  ])("by its id when its headline %s, so no two questions read alike", (_case, headlines) => {
    expect(renderWith(headlines, "q1")).toBe(
      "If question q1 is submitted, then require an answer to question q1."
    );
  });
});

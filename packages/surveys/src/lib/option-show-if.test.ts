import { describe, expect, test, vi } from "vitest";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { type TResponseData } from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { type TConditionGroup } from "@formbricks/types/surveys/logic";
import { advanceFromBlock, enterBlock, getPageAnswers, getPageVisibility } from "./block-flow";
import { type TNotShownStep, appendNotShownStep, buildNotShownRecord } from "./not-shown-record";

vi.mock("@/lib/i18n", () => ({
  getLocalizedValue: vi.fn((value, language) =>
    typeof value === "object" ? value[language] || value["default"] || "" : value
  ),
}));

/**
 * Option show-if and Hidden at runtime (ENG-6937): what a page offers, the question left with no
 * options, the answers re-submitted without options that became hidden, and the not-shown record.
 *
 * The survey: b1 asks "plan" (single select: basic, pro). b2 asks one question of the type under test,
 * whose second option is shown only for "pro" and whose third is Hidden.
 */

const proPicked: TConditionGroup = {
  id: "g-pro",
  connector: "and",
  conditions: [
    {
      id: "c-pro",
      leftOperand: { type: "element", value: "plan" },
      operator: "equals",
      rightOperand: { type: "static", value: "pro" },
    },
  ],
};

const option = (id: string, extra: { showIf?: TConditionGroup; hidden?: boolean } = {}) => ({
  id,
  label: { default: id.toUpperCase(), de: `${id}-de` },
  ...extra,
});

const options = () => [option("a"), option("b", { showIf: proPicked }), option("c", { hidden: true })];

const planQuestion = {
  id: "plan",
  type: TSurveyElementTypeEnum.MultipleChoiceSingle,
  headline: { default: "Plan" },
  required: false,
  choices: [option("basic"), option("pro")],
};

const pictureOption = (id: string, extra: { showIf?: TConditionGroup; hidden?: boolean } = {}) => ({
  id,
  imageUrl: `https://example.com/${id}.png`,
  ...extra,
});

const questionOfType = (type: string): Record<string, unknown> => {
  const base = { id: "q", headline: { default: "Q" }, required: false };
  switch (type) {
    case "pictureSelection":
      return {
        ...base,
        type,
        allowMulti: true,
        choices: [
          pictureOption("a"),
          pictureOption("b", { showIf: proPicked }),
          pictureOption("c", { hidden: true }),
        ],
      };
    case "matrix":
      return { ...base, type, rows: options(), columns: options() };
    default:
      return { ...base, type, choices: options() };
  }
};

const makeSurvey = (b2Elements: Record<string, unknown>[], extraBlocks: Record<string, unknown>[] = []) =>
  ({
    id: "survey1",
    name: "Survey",
    blocks: [
      { id: "b1", name: "b1", elements: [planQuestion] },
      { id: "b2", name: "b2", elements: b2Elements },
      ...extraBlocks,
    ],
    endings: [{ id: "end1", type: "endScreen", headline: { default: "end" } }],
    variables: [],
    embeddedFields: [],
    welcomeCard: { enabled: false },
    languages: [],
  }) as unknown as TJsWorkspaceStateSurvey;

const pageOf = (survey: TJsWorkspaceStateSurvey, responseData: TResponseData, blockId = "b2") =>
  getPageVisibility({
    survey,
    blockId,
    responseData,
    variables: {},
    selectedLanguage: "default",
    reservedFieldValues: {},
  });

const submitFrom = (
  survey: TJsWorkspaceStateSurvey,
  blockId: string,
  responseData: TResponseData,
  submittedData: TResponseData,
  selectedLanguage = "default"
) =>
  advanceFromBlock({
    survey,
    blockId,
    responseData,
    submittedData,
    variables: {},
    selectedLanguage,
    reservedFieldValues: {},
  });

describe("option show-if: what a page offers", () => {
  test.each(["multipleChoiceSingle", "multipleChoiceMulti", "ranking", "pictureSelection"])(
    "%s: an option is offered live once its show-if matches, and a Hidden one never",
    (type) => {
      const survey = makeSurvey([questionOfType(type)]);

      expect(pageOf(survey, { plan: "BASIC" }).optionsNotShown).toEqual({ q: { choices: ["b", "c"] } });
      expect(pageOf(survey, { plan: "PRO" }).optionsNotShown).toEqual({ q: { choices: ["c"] } });
    }
  );

  test("matrix rows and columns are filtered the same way", () => {
    const survey = makeSurvey([questionOfType("matrix")]);

    expect(pageOf(survey, { plan: "BASIC" }).optionsNotShown).toEqual({
      q: { rows: ["b", "c"], columns: ["b", "c"] },
    });
    expect(pageOf(survey, { plan: "PRO" }).optionsNotShown).toEqual({ q: { rows: ["c"], columns: ["c"] } });
  });

  test("Hidden wins over a show-if that matches", () => {
    const survey = makeSurvey([
      {
        ...questionOfType("multipleChoiceMulti"),
        choices: [option("a"), option("b", { hidden: true, showIf: proPicked })],
      },
    ]);

    expect(pageOf(survey, { plan: "PRO" }).optionsNotShown).toEqual({ q: { choices: ["b"] } });
  });

  test("a question with nothing to filter reports nothing", () => {
    const survey = makeSurvey([
      { ...questionOfType("multipleChoiceMulti"), choices: [option("a"), option("b")] },
    ]);

    expect(pageOf(survey, { plan: "BASIC" }).optionsNotShown).toEqual({});
  });

  test("an option's show-if reads a question above it on the same page", () => {
    const survey = makeSurvey([
      { ...planQuestion, id: "plan2" },
      {
        ...questionOfType("multipleChoiceMulti"),
        choices: [
          option("a"),
          option("b", {
            showIf: {
              ...proPicked,
              conditions: [{ ...proPicked.conditions[0], leftOperand: { type: "element", value: "plan2" } }],
            } as TConditionGroup,
          }),
        ],
      },
    ]);

    expect(pageOf(survey, { plan2: "BASIC" }).optionsNotShown).toEqual({ q: { choices: ["b"] } });
    expect(pageOf(survey, { plan2: "PRO" }).optionsNotShown).toEqual({});
  });
});

describe("option show-if: a question left with no options", () => {
  const onlyConditional = (type: string) => {
    const question = questionOfType(type);
    if (type === "matrix")
      return { ...question, columns: [option("b", { showIf: proPicked }), option("c", { hidden: true })] };
    const choices = question.choices as unknown[];
    return { ...question, choices: choices.slice(1) };
  };

  test.each(["multipleChoiceSingle", "multipleChoiceMulti", "ranking", "pictureSelection", "matrix"])(
    "%s: is skipped like a question hidden by its show-if",
    (type) => {
      const survey = makeSurvey([onlyConditional(type), { ...planQuestion, id: "after" }]);

      const page = pageOf(survey, { plan: "BASIC" });
      expect(page.visibleElementIds).toEqual(["after"]);
      expect(page.hiddenElementIds).toEqual(["q"]);
      expect(pageOf(survey, { plan: "PRO" }).visibleElementIds).toEqual(["q", "after"]);
    }
  );

  test("a page whose only question has no options left is passed over, and recorded", () => {
    const survey = makeSurvey(
      [onlyConditional("multipleChoiceMulti")],
      [{ id: "b3", name: "b3", elements: [{ ...planQuestion, id: "last" }] }]
    );

    const decision = submitFrom(survey, "b1", {}, { plan: "BASIC" });

    expect(decision.nextCardId).toBe("b3");
    expect(decision.skippedBlockIds).toEqual(["b2"]);
  });

  test("on the respondent's own page, its stale answer is dropped like a hidden question's", () => {
    const survey = makeSurvey([{ ...planQuestion, id: "plan2" }, onlyConditionalOn("plan2")]);

    const decision = submitFrom(survey, "b2", { q: ["B"] }, { plan2: "BASIC", q: ["B"] });

    expect(decision.hiddenElementIds).toEqual(["q"]);
    expect(decision.submittedData).toEqual({ plan2: "BASIC" });
  });
});

function onlyConditionalOn(elementId: string) {
  return {
    ...questionOfType("multipleChoiceMulti"),
    choices: [
      option("b", {
        showIf: {
          ...proPicked,
          conditions: [{ ...proPicked.conditions[0], leftOperand: { type: "element", value: elementId } }],
        } as TConditionGroup,
      }),
    ],
  };
}

describe("option show-if: answers without options that became hidden", () => {
  test.each([
    ["multipleChoiceMulti", ["A", "B"], ["A"]],
    ["ranking", ["B", "A"], ["A"]],
    ["pictureSelection", ["a", "b"], ["a"]],
    ["multipleChoiceSingle", "B", ""],
    ["multipleChoiceSingle", "A", undefined],
  ])("%s: a stored %j is re-submitted as %j", (type, stored, expected) => {
    const survey = makeSurvey([questionOfType(type)]);

    // Answered while "pro" was picked, then Back to b1 to pick "basic", and now submitting b2 untouched.
    const decision = submitFrom(survey, "b2", { plan: "BASIC", q: stored }, {});

    expect(decision.submittedData.q).toEqual(expected);
  });

  test("matrix: rows and cells of columns no longer shown are removed", () => {
    const survey = makeSurvey([questionOfType("matrix")]);

    const decision = submitFrom(survey, "b2", { plan: "BASIC" }, { q: { A: "A", B: "A", C: "A" } });
    expect(decision.submittedData.q).toEqual({ A: "A" });

    const allColumnsGone = submitFrom(survey, "b2", { plan: "BASIC" }, { q: { A: "B" } });
    expect(allColumnsGone.submittedData.q).toEqual({});
  });

  test("labels are matched in the respondent's language", () => {
    const survey = makeSurvey([questionOfType("multipleChoiceMulti")]);

    const decision = submitFrom(survey, "b2", { plan: "basic-de" }, { q: ["a-de", "b-de"] }, "de");

    expect(decision.submittedData.q).toEqual(["a-de"]);
  });

  test("an 'other' answer is dropped when the 'other' option is not shown", () => {
    const survey = makeSurvey([
      {
        ...questionOfType("multipleChoiceMulti"),
        choices: [option("a"), option("other", { showIf: proPicked })],
      },
    ]);

    expect(submitFrom(survey, "b2", { plan: "BASIC" }, { q: ["A", "my own"] }).submittedData.q).toEqual([
      "A",
    ]);
    expect(submitFrom(survey, "b2", { plan: "PRO" }, { q: ["A", "my own"] }).submittedData.q).toEqual([
      "A",
      "my own",
    ]);
  });

  test("conditions below read the answer without the options that became hidden", () => {
    const conditional = onlyConditionalOn("plan2");
    const survey = makeSurvey([
      { ...planQuestion, id: "plan2" },
      { ...conditional, choices: [option("a"), ...conditional.choices] },
      {
        id: "follow_up",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Why B?" },
        required: false,
        inputType: "text",
        charLimit: { enabled: false },
        showIf: {
          id: "g-b",
          connector: "and",
          conditions: [
            {
              id: "c-b",
              leftOperand: { type: "element", value: "q" },
              operator: "includesOneOf",
              rightOperand: { type: "static", value: ["b"] },
            },
          ],
        },
      },
    ]);

    expect(pageOf(survey, { plan2: "PRO", q: ["A", "B"] }).visibleElementIds).toContain("follow_up");
    expect(pageOf(survey, { plan2: "BASIC", q: ["A", "B"] }).visibleElementIds).not.toContain("follow_up");
  });
});

describe("option show-if: the answers a page shows", () => {
  test("an answer is shown without the options the page no longer offers; others are untouched", () => {
    const survey = makeSurvey([questionOfType("multipleChoiceMulti")]);
    const responseData = { plan: "BASIC", q: ["A", "B"], elsewhere: "kept" };

    expect(getPageAnswers(responseData, pageOf(survey, responseData))).toEqual({
      plan: "BASIC",
      q: ["A"],
      elsewhere: "kept",
    });
    expect(
      getPageAnswers({ plan: "PRO", q: ["A", "B"] }, pageOf(survey, { plan: "PRO", q: ["A", "B"] }))
    ).toEqual({ plan: "PRO", q: ["A", "B"] });
  });
});

describe("option show-if: the not-shown record", () => {
  const survey = makeSurvey(
    [questionOfType("multipleChoiceMulti"), questionOfType("matrix")].map((q, i) => ({ ...q, id: `q${i}` }))
  );

  const record = (steps: TNotShownStep[]) => buildNotShownRecord(survey, steps);
  const step = (blockId: string, responseData: TResponseData): TNotShownStep => {
    const decision = submitFrom(survey, blockId, responseData, {});
    return {
      blockId,
      hiddenElementIds: decision.hiddenElementIds,
      skippedBlockIds: decision.skippedBlockIds,
      optionsNotShown: decision.optionsNotShown,
    };
  };

  test("lists the options, rows and columns a shown question did not offer", () => {
    expect(record([step("b1", { plan: "BASIC" }), step("b2", { plan: "BASIC" })])).toEqual({
      options: { q0: ["b", "c"] },
      rows: { q1: ["b", "c"] },
      columns: { q1: ["b", "c"] },
    });
  });

  test("after Back and a changed answer, an option offered again drops out", () => {
    let steps = [step("b1", { plan: "BASIC" }), step("b2", { plan: "BASIC" })];
    steps = appendNotShownStep(steps, 1, step("b2", { plan: "PRO" }));

    expect(record(steps)).toEqual({ options: { q0: ["c"] }, rows: { q1: ["c"] }, columns: { q1: ["c"] } });
  });

  test("a question or block not shown lists no options: they go with it", () => {
    const steps: TNotShownStep[] = [
      step("b2", { plan: "BASIC" }),
      { blockId: "b1", hiddenElementIds: [], skippedBlockIds: ["b2"] },
    ];

    expect(record(steps)).toEqual({ blocks: ["b2"] });
  });

  test("entering a page straight away records nothing for it until it is submitted", () => {
    const entry = enterBlock({
      survey,
      blockId: "b2",
      responseData: { plan: "BASIC" },
      variables: {},
      selectedLanguage: "default",
      reservedFieldValues: {},
    });

    expect(entry.optionsNotShown).toEqual({});
  });
});

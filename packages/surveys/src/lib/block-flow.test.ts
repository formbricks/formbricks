import { describe, expect, test, vi } from "vitest";
import { embeddedFieldsFromLegacyInput } from "@formbricks/types/embedded-data-mapping";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { type TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { type TConditionGroup } from "@formbricks/types/surveys/logic";
import { type TAdvanceFromBlockInput, advanceFromBlock, enterBlock, getPageVisibility } from "./block-flow";

vi.mock("@/lib/i18n", () => ({
  getLocalizedValue: vi.fn((value, language) =>
    typeof value === "object" ? value[language] || value["default"] || "" : value
  ),
}));

const element = (id: string, extra: { showIf?: TConditionGroup; required?: boolean } = {}) => ({
  id,
  type: TSurveyElementTypeEnum.OpenText,
  headline: { default: id },
  required: false,
  inputType: "text",
  charLimit: { enabled: false },
  ...extra,
});

const block = (
  id: string,
  extra: {
    logic?: TSurveyBlockLogic[];
    logicFallback?: string;
    showIf?: TConditionGroup;
    elements?: ReturnType<typeof element>[];
  } = {}
) => ({
  id,
  name: id,
  elements: [element(`${id}-q`)],
  ...extra,
});

const answerEquals = (elementId: string, value: string) => ({
  id: `cond-${elementId}`,
  connector: "and" as const,
  conditions: [
    {
      id: `c-${elementId}`,
      operator: "equals" as const,
      leftOperand: { type: "element" as const, value: elementId },
      rightOperand: { type: "static" as const, value },
    },
  ],
});

const rule = (id: string, when: string, actions: TSurveyBlockLogic["actions"]): TSurveyBlockLogic => ({
  id,
  conditions: answerEquals("b1-q", when),
  actions,
});

const scoreVariables = [{ id: "score", name: "score", type: "number" as const, value: 0 }];

const makeSurvey = (
  blocks: ReturnType<typeof block>[],
  endings: string[] = ["end1", "end2"]
): TJsWorkspaceStateSurvey =>
  ({
    id: "survey1",
    name: "Survey",
    blocks,
    endings: endings.map((id) => ({ id, type: "endScreen", headline: { default: id } })),
    variables: scoreVariables,
    embeddedFields: embeddedFieldsFromLegacyInput({ variables: scoreVariables }),
    welcomeCard: { enabled: false },
    languages: [],
  }) as unknown as TJsWorkspaceStateSurvey;

const advance = (survey: TJsWorkspaceStateSurvey, overrides: Partial<TAdvanceFromBlockInput> = {}) =>
  advanceFromBlock({
    survey,
    blockId: "b1",
    responseData: {},
    submittedData: { "b1-q": "a" },
    variables: {},
    selectedLanguage: "default",
    reservedFieldValues: {},
    ...overrides,
  });

describe("advanceFromBlock", () => {
  test("moves to the next block in order when no logic applies", () => {
    const result = advance(makeSurvey([block("b1"), block("b2")]));

    expect(result).toMatchObject({
      nextBlockId: "b2",
      nextCardId: "b2",
      finished: false,
      endingId: undefined,
      requiredQuestionIds: [],
    });
  });

  test("finishes on the first ending after the last block", () => {
    const result = advance(makeSurvey([block("b1")]));

    expect(result).toMatchObject({
      nextBlockId: undefined,
      nextCardId: "end1",
      finished: true,
      endingId: "end1",
    });
  });

  test("falls back to the end sentinel when the survey has no endings", () => {
    const result = advance(makeSurvey([block("b1")], []));

    expect(result).toMatchObject({ nextCardId: "end", finished: true, endingId: undefined });
  });

  test("the first rule that jumps wins; later rules still contribute calculations and requires", () => {
    const survey = makeSurvey([
      block("b1", {
        logic: [
          rule("r1", "a", [{ id: "a1", objective: "jumpToBlock", target: "b3" }]),
          rule("r2", "a", [
            { id: "a2", objective: "jumpToBlock", target: "b2" },
            { id: "a3", objective: "requireAnswer", target: "b2-q" },
            {
              id: "a4",
              objective: "calculate",
              variableId: "score",
              operator: "add",
              value: { type: "static", value: 5 },
            },
          ]),
        ],
      }),
      block("b2"),
      block("b3"),
    ]);

    const result = advance(survey, { variables: { score: 1 } });

    expect(result.nextBlockId).toBe("b3");
    expect(result.requiredQuestionIds).toEqual(["b2-q"]);
    expect(result.variables).toEqual({ score: 6 });
  });

  test("applies calculations from earlier rules to later rules", () => {
    const survey = makeSurvey([
      block("b1", {
        logic: [
          rule("r1", "a", [
            {
              id: "a1",
              objective: "calculate",
              variableId: "score",
              operator: "add",
              value: { type: "static", value: 2 },
            },
          ]),
          rule("r2", "a", [
            {
              id: "a2",
              objective: "calculate",
              variableId: "score",
              operator: "multiply",
              value: { type: "static", value: 10 },
            },
          ]),
        ],
      }),
    ]);

    expect(advance(survey, { variables: { score: 1 } }).variables).toEqual({ score: 30 });
  });

  test("ignores rules whose conditions are not met", () => {
    const survey = makeSurvey([
      block("b1", { logic: [rule("r1", "other", [{ id: "a1", objective: "jumpToBlock", target: "b3" }])] }),
      block("b2"),
      block("b3"),
    ]);

    expect(advance(survey).nextBlockId).toBe("b2");
  });

  test("uses logicFallback only when no rule jumped", () => {
    const withFallback = (logic: TSurveyBlockLogic[]) =>
      makeSurvey([block("b1", { logic, logicFallback: "b3" }), block("b2"), block("b3")]);

    expect(advance(withFallback([])).nextBlockId).toBe("b3");
    expect(
      advance(withFallback([rule("r1", "a", [{ id: "a1", objective: "jumpToBlock", target: "b2" }])]))
        .nextBlockId
    ).toBe("b2");
  });

  test("jumping to an ending finishes the survey on that ending", () => {
    const survey = makeSurvey([
      block("b1", { logic: [rule("r1", "a", [{ id: "a1", objective: "jumpToBlock", target: "end2" }])] }),
      block("b2"),
    ]);

    expect(advance(survey)).toMatchObject({
      nextBlockId: "end2",
      nextCardId: "end2",
      finished: true,
      endingId: "end2",
    });
  });

  test("a jump to a deleted block or ending counts as no target", () => {
    const survey = makeSurvey([
      block("b1", { logic: [rule("r1", "a", [{ id: "a1", objective: "jumpToBlock", target: "gone" }])] }),
      block("b2"),
    ]);

    expect(advance(survey)).toMatchObject({
      nextBlockId: undefined,
      nextCardId: "end1",
      finished: true,
      endingId: "end1",
    });
  });

  test("a rule reads the answers submitted from the current block", () => {
    const survey = makeSurvey([
      block("b1", { logic: [rule("r1", "yes", [{ id: "a1", objective: "jumpToBlock", target: "b3" }])] }),
      block("b2"),
      block("b3"),
    ]);

    expect(advance(survey, { submittedData: { "b1-q": "yes" } }).nextBlockId).toBe("b3");
    expect(advance(survey, { submittedData: { "b1-q": "no" } }).nextBlockId).toBe("b2");
  });

  test("the start sentinel advances to the first block without evaluating logic", () => {
    const result = advance(makeSurvey([block("b1"), block("b2")]), {
      blockId: "start",
      variables: { score: 3 },
    });

    expect(result).toMatchObject({ nextBlockId: "b1", finished: false, variables: {} });
  });

  describe("a blockId that is not a block", () => {
    test("an ending id keeps that ending and keeps variables", () => {
      const result = advance(makeSurvey([block("b1")]), { blockId: "end2", variables: { score: 3 } });

      expect(result).toMatchObject({
        nextBlockId: "end2",
        finished: true,
        endingId: "end2",
        variables: { score: 3 },
        requiredQuestionIds: [],
      });
    });

    test("the end sentinel finishes quietly", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = advance(makeSurvey([block("b1")]), { blockId: "end" });

      expect(result).toMatchObject({ nextBlockId: undefined, finished: true, endingId: "end1" });
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    test("a block deleted after progress was saved finishes the survey and warns (ENG-2818)", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = advance(makeSurvey([block("b1")]), { blockId: "deleted", variables: { score: 3 } });

      expect(result).toMatchObject({
        nextBlockId: undefined,
        nextCardId: "end1",
        finished: true,
        endingId: "end1",
        variables: { score: 3 },
      });
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });
  });
});

const hiddenFieldIsSet = (fieldId: string): TConditionGroup => ({
  id: `set-${fieldId}`,
  connector: "and",
  conditions: [
    {
      id: `c-set-${fieldId}`,
      operator: "isSet",
      leftOperand: { type: "hiddenField", value: fieldId },
    },
  ],
});

const addToScore = (id: string, amount: number): TSurveyBlockLogic["actions"][number] => ({
  id,
  objective: "calculate",
  variableId: "score",
  operator: "add",
  value: { type: "static", value: amount },
});

const always = (id: string, actions: TSurveyBlockLogic["actions"]): TSurveyBlockLogic => ({
  id,
  conditions: { id: `g-${id}`, connector: "and", conditions: [] },
  actions,
});

describe("show-if: what a page shows", () => {
  // b2 asks "fav", then a follow-up shown only for "apple", then one shown only when the follow-up says "price".
  const page = block("b2", {
    elements: [
      element("fav"),
      element("why_apple", { showIf: answerEquals("fav", "apple"), required: true }),
      element("price_detail", { showIf: answerEquals("why_apple", "price") }),
    ],
  });
  const survey = makeSurvey([block("b1"), page]);
  const visibility = (responseData: Record<string, string>) =>
    getPageVisibility({
      survey,
      blockId: "b2",
      responseData,
      variables: {},
      selectedLanguage: "default",
      reservedFieldValues: {},
    });

  test("a follow-up appears live once the answer above it matches", () => {
    expect(visibility({}).visibleElementIds).toEqual(["fav"]);
    expect(visibility({ fav: "apple" }).visibleElementIds).toEqual(["fav", "why_apple"]);
    expect(visibility({ fav: "apple", why_apple: "price" }).visibleElementIds).toEqual([
      "fav",
      "why_apple",
      "price_detail",
    ]);
  });

  test("an answer to a question that became hidden reads as unanswered for the questions below it", () => {
    // The respondent answered the follow-up, then changed "fav": the follow-up hides, so does its child.
    const result = visibility({ fav: "netflix", why_apple: "price" });

    expect(result.visibleElementIds).toEqual(["fav"]);
    expect(result.hiddenElementIds).toEqual(["why_apple", "price_detail"]);
  });

  test("a hidden required question is not part of the page, so it never blocks submission", () => {
    expect(visibility({ fav: "netflix" }).visibleElementIds).not.toContain("why_apple");
  });

  test("an empty show-if group means always shown, whatever its connector", () => {
    const emptyOr = makeSurvey([
      block("b1", {
        showIf: { id: "g", connector: "or", conditions: [] },
        elements: [element("q", { showIf: { id: "g2", connector: "or", conditions: [] } })],
      }),
    ]);
    const result = getPageVisibility({
      survey: emptyOr,
      blockId: "b1",
      responseData: {},
      variables: {},
      selectedLanguage: "default",
      reservedFieldValues: {},
    });

    expect(result).toMatchObject({ shown: true, visibleElementIds: ["q"], hiddenElementIds: [] });
  });
});

describe("show-if: advancing", () => {
  test("the current page's hidden answers are not submitted, and its logic doesn't see them", () => {
    const survey = makeSurvey([
      block("b1", {
        elements: [element("b1-q"), element("follow_up", { showIf: answerEquals("b1-q", "yes") })],
        logic: [
          {
            id: "r1",
            conditions: answerEquals("follow_up", "stale"),
            actions: [{ id: "a1", objective: "jumpToBlock", target: "end2" }],
          },
        ],
      }),
      block("b2"),
    ]);

    const result = advance(survey, {
      // Answered the follow-up while "yes" was picked, then changed the answer above it.
      responseData: { follow_up: "stale" },
      submittedData: { "b1-q": "no", follow_up: "stale" },
    });

    expect(result.submittedData).toEqual({ "b1-q": "no" });
    expect(result.hiddenElementIds).toEqual(["follow_up"]);
    expect(result.nextBlockId).toBe("b2");
  });

  test("a block whose show-if fails is skipped, and its logic still runs as if submitted with no answers", () => {
    const survey = makeSurvey([
      block("b1"),
      block("b2", {
        showIf: hiddenFieldIsSet("panel_id"),
        logic: [
          always("r1", [addToScore("a1", 5)]),
          // Reads its own question, which counts as unanswered.
          {
            id: "r2",
            conditions: {
              id: "g2",
              connector: "and",
              conditions: [
                { id: "c2", operator: "isSkipped", leftOperand: { type: "element", value: "b2-q" } },
              ],
            },
            actions: [{ id: "a2", objective: "jumpToBlock", target: "b4" }],
          },
        ],
      }),
      block("b3"),
      block("b4"),
    ]);

    // A stale answer from before Back still counts as unanswered on the skipped block.
    const result = advance(survey, { variables: { score: 1 }, responseData: { "b2-q": "old" } });

    expect(result).toMatchObject({
      nextBlockId: "b4",
      finished: false,
      skippedBlockIds: ["b2"],
      variables: { score: 6 },
    });
  });

  test("a block shown by its show-if is not skipped", () => {
    const survey = makeSurvey([
      block("b1"),
      block("b2", { showIf: hiddenFieldIsSet("panel_id") }),
      block("b3"),
    ]);

    const result = advance(survey, { responseData: { panel_id: "p-1" } });

    expect(result).toMatchObject({ nextBlockId: "b2", skippedBlockIds: [] });
  });

  test("a block whose questions are all hidden is skipped, running its logic", () => {
    const survey = makeSurvey([
      block("b1"),
      block("b2", {
        elements: [element("b2-q", { showIf: answerEquals("b1-q", "yes") })],
        logic: [always("r1", [addToScore("a1", 2)])],
        logicFallback: "b4",
      }),
      block("b3"),
      block("b4"),
    ]);

    expect(advance(survey, { submittedData: { "b1-q": "no" } })).toMatchObject({
      nextBlockId: "b4",
      skippedBlockIds: ["b2"],
      variables: { score: 2 },
    });
    expect(advance(survey, { submittedData: { "b1-q": "yes" } })).toMatchObject({
      nextBlockId: "b2",
      skippedBlockIds: [],
    });
  });

  test("skipped blocks chain, and skipping the last block finishes on the first ending", () => {
    const hidden = { showIf: hiddenFieldIsSet("panel_id") };
    const survey = makeSurvey([block("b1"), block("b2", hidden), block("b3", hidden)]);

    expect(advance(survey)).toMatchObject({
      nextBlockId: undefined,
      nextCardId: "end1",
      finished: true,
      endingId: "end1",
      skippedBlockIds: ["b2", "b3"],
    });
  });

  test("a skipped block's jump to an ending finishes on that ending", () => {
    const survey = makeSurvey([
      block("b1"),
      block("b2", {
        showIf: hiddenFieldIsSet("panel_id"),
        logic: [always("r1", [{ id: "a1", objective: "jumpToBlock", target: "end2" }])],
      }),
      block("b3"),
    ]);

    expect(advance(survey)).toMatchObject({ nextCardId: "end2", finished: true, endingId: "end2" });
  });

  test("skipped blocks that jump back to each other finish rather than loop forever", () => {
    const hidden = hiddenFieldIsSet("panel_id");
    const survey = makeSurvey([
      block("b1"),
      block("b2", {
        showIf: hidden,
        logic: [always("r1", [{ id: "a1", objective: "jumpToBlock", target: "b3" }])],
      }),
      block("b3", {
        showIf: hidden,
        logic: [always("r2", [{ id: "a2", objective: "jumpToBlock", target: "b2" }])],
      }),
    ]);

    expect(advance(survey)).toMatchObject({ finished: true, endingId: "end1" });
  });

  test("from the welcome card, a hidden first block is skipped", () => {
    const survey = makeSurvey([block("b1", { showIf: hiddenFieldIsSet("panel_id") }), block("b2")]);

    expect(advance(survey, { blockId: "start", submittedData: {} })).toMatchObject({
      nextBlockId: "b2",
      skippedBlockIds: ["b1"],
    });
  });
});

describe("show-if: entering the survey without the welcome card", () => {
  const enter = (survey: TJsWorkspaceStateSurvey, blockId: string, responseData = {}) =>
    enterBlock({
      survey,
      blockId,
      responseData,
      variables: { score: 1 },
      selectedLanguage: "default",
      reservedFieldValues: {},
    });

  test("a shown first block is entered as it is", () => {
    expect(enter(makeSurvey([block("b1"), block("b2")]), "b1")).toMatchObject({
      nextCardId: "b1",
      finished: false,
      skippedBlockIds: [],
      variables: { score: 1 },
    });
  });

  test("a hidden first block is skipped, running its logic", () => {
    const survey = makeSurvey([
      block("b1", { showIf: hiddenFieldIsSet("panel_id"), logic: [always("r1", [addToScore("a1", 4)])] }),
      block("b2"),
    ]);

    expect(enter(survey, "b1")).toMatchObject({
      nextCardId: "b2",
      finished: false,
      skippedBlockIds: ["b1"],
      variables: { score: 5 },
    });
    expect(enter(survey, "b1", { panel_id: "p-1" })).toMatchObject({ nextCardId: "b1", skippedBlockIds: [] });
  });

  test("when every block is hidden, the survey finishes on the first ending", () => {
    const survey = makeSurvey([block("b1", { showIf: hiddenFieldIsSet("panel_id") })]);

    expect(enter(survey, "b1")).toMatchObject({ nextCardId: "end1", finished: true, endingId: "end1" });
  });
});

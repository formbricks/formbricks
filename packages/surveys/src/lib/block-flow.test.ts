import { describe, expect, test, vi } from "vitest";
import { embeddedFieldsFromLegacyInput } from "@formbricks/types/embedded-data-mapping";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { type TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { type TAdvanceFromBlockInput, advanceFromBlock } from "./block-flow";

vi.mock("@/lib/i18n", () => ({
  getLocalizedValue: vi.fn((value, language) =>
    typeof value === "object" ? value[language] || value["default"] || "" : value
  ),
}));

const element = (id: string) => ({
  id,
  type: TSurveyElementTypeEnum.OpenText,
  headline: { default: id },
  required: false,
  inputType: "text",
  charLimit: { enabled: false },
});

const block = (id: string, extra: { logic?: TSurveyBlockLogic[]; logicFallback?: string } = {}) => ({
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

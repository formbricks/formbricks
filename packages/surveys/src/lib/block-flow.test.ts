import { describe, expect, test, vi } from "vitest";
import { embeddedFieldsFromLegacyInput } from "@formbricks/types/embedded-data-mapping";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { type TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import {
  type TAdvanceFromBlockInput,
  type TStartSurveyInput,
  advanceFromBlock,
  startSurvey,
} from "./block-flow";

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

  test("the start sentinel advances to the first block without evaluating block logic, keeping variables", () => {
    const result = advance(makeSurvey([block("b1"), block("b2")]), {
      blockId: "start",
      variables: { score: 3 },
    });

    // Values set before the first question travel with the first submit (ENG-6932).
    expect(result).toMatchObject({ nextBlockId: "b1", finished: false, variables: { score: 3 } });
  });

  test("the start sentinel advances to where the rules before the first question sent the respondent", () => {
    const result = advance(makeSurvey([block("b1"), block("b2"), block("b3")]), {
      blockId: "start",
      startBlockId: "b3",
    });

    expect(result).toMatchObject({ nextBlockId: "b3", finished: false });
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

describe("startSurvey: rules before the first question (ENG-6932)", () => {
  const fieldIs = (fieldId: string, value: string) => ({
    id: `cond-${fieldId}`,
    connector: "and" as const,
    conditions: [
      {
        id: `c-${fieldId}`,
        operator: "equals" as const,
        leftOperand: { type: "hiddenField" as const, value: fieldId },
        rightOperand: { type: "static" as const, value },
      },
    ],
  });

  const startRule = (
    id: string,
    fieldId: string,
    value: string,
    actions: TSurveyBlockLogic["actions"]
  ): TSurveyBlockLogic => ({ id, conditions: fieldIs(fieldId, value), actions });

  const jumpTo = (target: string) => ({ id: `jump-${target}`, objective: "jumpToBlock" as const, target });
  const setScore = (value: number) => ({
    id: `set-${String(value)}`,
    objective: "calculate" as const,
    variableId: "score",
    operator: "assign" as const,
    value: { type: "static" as const, value },
  });

  const withStart = (
    startLogic: TSurveyBlockLogic[] | null | undefined,
    { welcome = false }: { welcome?: boolean } = {}
  ): TJsWorkspaceStateSurvey => {
    const survey = makeSurvey([block("b1"), block("b2"), block("b3")]);
    return { ...survey, startLogic, welcomeCard: { ...survey.welcomeCard, enabled: welcome } };
  };

  const start = (survey: TJsWorkspaceStateSurvey, overrides: Partial<TStartSurveyInput> = {}) =>
    startSurvey({
      survey,
      responseData: {},
      variables: { score: 0 },
      selectedLanguage: "default",
      reservedFieldValues: {},
      ...overrides,
    });

  const screener = [
    startRule("screen-out", "panel", "none", [jumpTo("end2")]),
    startRule("heavy", "seg", "heavy", [setScore(10), jumpTo("b3")]),
  ];

  test("without rules, the survey starts as it always did", () => {
    expect(start(withStart(undefined))).toMatchObject({ firstCardId: "b1", finished: false });
    expect(start(withStart(null, { welcome: true }))).toMatchObject({
      firstCardId: "start",
      startBlockId: undefined,
      finished: false,
    });
    expect(start(withStart([]), { startAtBlockId: "b2" })).toMatchObject({ firstCardId: "b2" });
  });

  test("falls through to the first block when no rule matches", () => {
    const result = start(withStart(screener), { responseData: { panel: "p1", seg: "light" } });

    expect(result).toEqual({
      firstCardId: "b1",
      startBlockId: undefined,
      finished: false,
      endingId: undefined,
      variables: { score: 0 },
    });
  });

  test("a screen-out shows only the ending, before the welcome card", () => {
    const result = start(withStart(screener, { welcome: true }), { responseData: { panel: "none" } });

    expect(result).toMatchObject({ firstCardId: "end2", finished: true, endingId: "end2" });
  });

  test("a screen-out also applies on a start-at link, so screening can't be skipped", () => {
    const result = start(withStart(screener), { responseData: { panel: "none" }, startAtBlockId: "b2" });

    expect(result).toMatchObject({ firstCardId: "end2", finished: true, endingId: "end2" });
  });

  test("a jump to a block goes there, and the welcome card still shows first and leads there", () => {
    const noWelcome = start(withStart(screener), { responseData: { seg: "heavy" } });
    const welcome = start(withStart(screener, { welcome: true }), { responseData: { seg: "heavy" } });

    expect(noWelcome).toMatchObject({ firstCardId: "b3", startBlockId: "b3", finished: false });
    expect(welcome).toMatchObject({ firstCardId: "start", startBlockId: "b3", finished: false });
  });

  test("a jump wins over a start-at link; without one, the start-at block is kept", () => {
    expect(
      start(withStart(screener), { responseData: { seg: "heavy" }, startAtBlockId: "b2" })
    ).toMatchObject({ firstCardId: "b3" });
    expect(
      start(withStart(screener), { responseData: { seg: "light" }, startAtBlockId: "b2" })
    ).toMatchObject({ firstCardId: "b2" });
  });

  test("a set value is carried into the first page's submit", () => {
    const survey = withStart([startRule("tag", "seg", "heavy", [setScore(10)])]);
    const started = start(survey, { responseData: { seg: "heavy" } });

    expect(started).toMatchObject({ firstCardId: "b1", variables: { score: 10 } });

    const firstPage = advance(survey, { variables: started.variables, responseData: { seg: "heavy" } });
    expect(firstPage.variables).toEqual({ score: 10 });
  });

  test("the first jump wins, and every matching rule's calculations run", () => {
    const survey = withStart([
      startRule("first", "seg", "heavy", [setScore(1), jumpTo("b2")]),
      startRule("second", "seg", "heavy", [
        { ...setScore(5), id: "add", operator: "add" as const },
        jumpTo("end1"),
      ]),
    ]);

    expect(start(survey, { responseData: { seg: "heavy" } })).toMatchObject({
      firstCardId: "b2",
      finished: false,
      variables: { score: 6 },
    });
  });

  test("a jump to a deleted block or ending counts as no jump", () => {
    const survey = withStart([startRule("stale", "seg", "heavy", [jumpTo("gone")])]);

    expect(start(survey, { responseData: { seg: "heavy" } })).toMatchObject({
      firstCardId: "b1",
      finished: false,
    });
  });

  test("rules read reserved fields too", () => {
    const survey = withStart([
      {
        id: "lang",
        conditions: {
          id: "g",
          connector: "and",
          conditions: [
            {
              id: "c",
              operator: "equals",
              leftOperand: { type: "reserved", value: "language" },
              rightOperand: { type: "static", value: "de" },
            },
          ],
        },
        actions: [jumpTo("end1")],
      },
    ]);

    expect(start(survey, { reservedFieldValues: { language: "de" } })).toMatchObject({
      firstCardId: "end1",
      finished: true,
    });
  });
});

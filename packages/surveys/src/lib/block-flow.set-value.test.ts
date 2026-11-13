import { describe, expect, test, vi } from "vitest";
import type { TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { type TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { TExpression } from "@formbricks/types/surveys/expressions";
import { type TAdvanceFromBlockInput, advanceFromBlock } from "./block-flow";

/**
 * Set value with expressions (ENG-6935, ADR 0030 / 0031): a `calculate` action with `operator: "assign"`
 * and an `expression` value, evaluated by the one shared evaluator. Plain survey and answers in, the
 * variables the flow decided out.
 */

vi.mock("@/lib/i18n", () => ({
  getLocalizedValue: vi.fn((value, language) =>
    typeof value === "object" ? value[language] || value["default"] || "" : value
  ),
}));

const computed = (storageKey: string, dataType: "number" | "string" | "date"): TLinkedEmbeddedField => ({
  field: {
    key: null,
    name: storageKey,
    source: "computed",
    dataType,
    defaultValue: null,
    locked: false,
  },
  link: { storageKey },
});

const ingested = (storageKey: string, dataType: "number" | "string" | "date"): TLinkedEmbeddedField => ({
  field: { key: null, name: storageKey, source: "ingested", dataType, defaultValue: null, locked: false },
  link: { storageKey },
});

const elements = [
  { id: "rating", type: TSurveyElementTypeEnum.Rating, scale: "number", range: 5 },
  { id: "nps", type: TSurveyElementTypeEnum.NPS },
  { id: "amount", type: TSurveyElementTypeEnum.OpenText, inputType: "number" },
  { id: "name", type: TSurveyElementTypeEnum.OpenText, inputType: "text" },
  {
    id: "plan",
    type: TSurveyElementTypeEnum.MultipleChoiceSingle,
    choices: [
      { id: "basic", label: { default: "Basic", de: "Einfach" }, code: "1" },
      { id: "premium", label: { default: "Premium", de: "Premium" }, code: "2" },
      { id: "other", label: { default: "Other", de: "Andere" }, code: "99" },
    ],
  },
  { id: "purchased", type: TSurveyElementTypeEnum.Date },
].map((element) => ({ headline: { default: element.id }, required: false, ...element }));

const embeddedFields = [
  computed("score", "number"),
  computed("label", "string"),
  computed("signup", "date"),
  ingested("visits", "number"),
  ingested("source", "string"),
];

const setValue = (variableId: string, expression: TExpression): TSurveyBlockLogic => ({
  id: `rule-${variableId}`,
  // ADR 0031: an always-run step is a rule whose condition group is an empty `and` group.
  conditions: { id: "always", connector: "and", conditions: [] },
  actions: [
    {
      id: `action-${variableId}`,
      objective: "calculate",
      variableId,
      operator: "assign",
      value: { type: "expression", value: expression },
    },
  ],
});

const makeSurvey = (logic: TSurveyBlockLogic[]): TJsWorkspaceStateSurvey =>
  ({
    id: "survey1",
    name: "Survey",
    blocks: [
      { id: "b1", name: "b1", elements, logic },
      { id: "b2", name: "b2", elements: [] },
    ],
    endings: [],
    variables: [],
    embeddedFields,
    welcomeCard: { enabled: false },
    languages: [],
  }) as unknown as TJsWorkspaceStateSurvey;

const advance = (logic: TSurveyBlockLogic[], overrides: Partial<TAdvanceFromBlockInput> = {}) =>
  advanceFromBlock({
    survey: makeSurvey(logic),
    blockId: "b1",
    responseData: {},
    submittedData: {},
    variables: {},
    selectedLanguage: "default",
    reservedFieldValues: {},
    ...overrides,
  });

const num = (value: number): TExpression => ({ type: "static", value });
const text = (value: string): TExpression => ({ type: "static", value });
const answer = (elementId: string): TExpression => ({ type: "element", value: elementId });
const call = (fn: string, ...args: TExpression[]) => ({ type: "call", fn, args }) as TExpression;

/** What the step sets `score` to for these answers. */
const scoreOf = (expression: TExpression, submittedData: TAdvanceFromBlockInput["submittedData"] = {}) =>
  advance([setValue("score", expression)], { submittedData }).variables.score;

describe("advanceFromBlock: Set value with expressions", () => {
  test("an always-run step (empty and group) sets score = round(rating + nps * 2)", () => {
    const expression = call("round", call("add", answer("rating"), call("multiply", answer("nps"), num(2))));

    expect(scoreOf(expression, { rating: 4, nps: 8 })).toBe(20);
  });

  test("a conditional calculation sets its value only when its condition matches", () => {
    const conditional: TSurveyBlockLogic = {
      ...setValue("score", call("add", answer("rating"), num(10))),
      conditions: {
        id: "g",
        connector: "and",
        conditions: [
          {
            id: "c",
            leftOperand: { type: "element", value: "name" },
            operator: "equals",
            rightOperand: { type: "static", value: "Ada" },
          },
        ],
      },
    };

    expect(advance([conditional], { submittedData: { rating: 3, name: "Ada" } }).variables.score).toBe(13);
    expect(advance([conditional], { submittedData: { rating: 3, name: "Bob" } }).variables).toEqual({});
  });

  describe("every function", () => {
    test.each([
      ["add", call("add", num(1), num(2), num(3)), 6],
      ["subtract", call("subtract", num(10), num(4)), 6],
      ["multiply", call("multiply", num(2), num(3), num(4)), 24],
      ["divide", call("divide", num(7), num(2)), 3.5],
      ["round to whole", call("round", num(2.5)), 3],
      ["round to decimals", call("round", num(1.005), num(2)), 1.01],
      ["round half away from zero", call("round", num(-2.5)), -3],
      ["min", call("min", num(4), num(-1), num(7)), -1],
      ["max", call("max", num(4), num(-1), num(7)), 7],
      ["abs", call("abs", num(-3)), 3],
      ["ifEmpty with a value", call("ifEmpty", num(5), num(0)), 5],
    ])("%s", (_name, expression, expected) => {
      expect(scoreOf(expression)).toBe(expected);
    });

    test("concat joins text, numbers and dates as text", () => {
      const expression = call(
        "concat",
        answer("name"),
        text("-"),
        answer("rating"),
        text("-"),
        answer("purchased")
      );
      const result = advance([setValue("label", expression)], {
        submittedData: { name: "Ada", rating: 4, purchased: "2026-02-01" },
      });

      expect(result.variables.label).toBe("Ada-4-2026-02-01");
    });

    test("now() is the device clock as a UTC ISO timestamp", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-03T09:30:00.000Z"));

      const result = advance([setValue("signup", call("now"))]);

      expect(result.variables.signup).toBe("2026-11-03T09:30:00.000Z");
      vi.useRealTimers();
    });
  });

  describe("UTC calendar days", () => {
    test("daysBetween counts calendar days from a to b, negative allowed", () => {
      const forward = call("daysBetween", answer("purchased"), text("2026-03-01"));
      const backward = call("daysBetween", text("2026-03-01"), answer("purchased"));

      expect(scoreOf(forward, { purchased: "2026-02-01" })).toBe(28);
      expect(scoreOf(backward, { purchased: "2026-02-01" })).toBe(-28);
    });

    test("daysBetween counts the UTC calendar date, not elapsed 24-hour periods", () => {
      // 23:59 to 00:01 UTC the next day is two minutes, and one calendar day.
      const expression = call(
        "daysBetween",
        text("2026-03-01T23:59:00.000Z"),
        text("2026-03-02T00:01:00.000Z")
      );

      expect(scoreOf(expression)).toBe(1);
    });

    test("daysBetween reads a date set by now() earlier in the flow", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-03T22:00:00.000Z"));

      const result = advance(
        [
          setValue("signup", call("now")),
          setValue("score", call("daysBetween", answer("purchased"), { type: "variable", value: "signup" })),
        ],
        { submittedData: { purchased: "2026-11-01" } }
      );

      expect(result.variables.score).toBe(2);
      vi.useRealTimers();
    });
  });

  describe("empty values", () => {
    test("an unanswered question makes arithmetic empty, which clears the field", () => {
      const result = advance([setValue("score", call("add", answer("rating"), num(1)))], {
        variables: { score: 7 },
      });

      // Stored as "" so the merge-only response update overwrites the old value.
      expect(result.variables.score).toBe("");
    });

    test("ifEmpty sets a default for an unanswered question", () => {
      expect(scoreOf(call("add", call("ifEmpty", answer("rating"), num(0)), num(1)))).toBe(1);
    });

    test("dividing by zero gives empty", () => {
      expect(scoreOf(call("divide", num(1), num(0)))).toBe("");
    });

    test("a value that isn't a number counts as empty", () => {
      expect(scoreOf(call("add", answer("amount"), num(1)), { amount: "abc" })).toBe("");
      expect(scoreOf(call("add", answer("amount"), num(1)), { amount: "41" })).toBe(42);
    });

    test("an ingested number field that isn't a number counts as empty", () => {
      expect(scoreOf(call("add", { type: "hiddenField", value: "visits" }, num(1)), { visits: "n/a" })).toBe(
        ""
      );
      expect(scoreOf(call("add", { type: "hiddenField", value: "visits" }, num(1)), { visits: "2" })).toBe(3);
    });

    test("concat with an empty input is empty", () => {
      const result = advance([setValue("label", call("concat", answer("name"), text("!")))]);

      expect(result.variables.label).toBe("");
    });

    test("daysBetween with a date that doesn't parse is empty", () => {
      expect(
        scoreOf(call("daysBetween", answer("purchased"), text("2026-03-01")), { purchased: "soon" })
      ).toBe("");
    });
  });

  test("a single-select answer yields its answer code, whatever the respondent's language", () => {
    const expression = call("concat", text("plan-"), answer("plan"));

    const inGerman = advance([setValue("label", expression)], {
      submittedData: { plan: "Einfach" },
      selectedLanguage: "de",
    });
    const otherWriteIn = advance([setValue("label", expression)], { submittedData: { plan: "Netflix" } });

    expect(inGerman.variables.label).toBe("plan-1");
    expect(otherWriteIn.variables.label).toBe("plan-99");
  });

  test("a computed field reads the value an earlier step set", () => {
    const result = advance([
      setValue("score", num(4)),
      setValue("score", call("multiply", { type: "variable", value: "score" }, num(3))),
    ]);

    expect(result.variables.score).toBe(12);
  });

  test("a reserved field reads the reserved value map", () => {
    const result = advance([setValue("label", { type: "reserved", value: "language" })], {
      reservedFieldValues: { language: "de" },
    });

    expect(result.variables.label).toBe("de");
  });

  test("old calculate operators keep counting empty as 0", () => {
    const legacy: TSurveyBlockLogic = {
      id: "legacy",
      conditions: { id: "always", connector: "and", conditions: [] },
      actions: [
        {
          id: "a",
          objective: "calculate",
          variableId: "score",
          operator: "add",
          value: { type: "static", value: 1 },
        },
      ],
    };

    expect(advance([legacy]).variables.score).toBe(1);
  });
});

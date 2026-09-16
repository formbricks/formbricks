import { describe, expect, test } from "vitest";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { type TSurveyQuota } from "@formbricks/types/quota";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { type TSurvey } from "@formbricks/types/surveys/types";
import { findEmbeddedFieldRemovalBlocker } from "./embedded-field-removal";

const PLAN = "plan";

const entry = (source: "computed" | "ingested"): TLinkedEmbeddedField => ({
  field: { key: null, name: "Plan", source, dataType: "string", defaultValue: null, locked: false },
  link: { storageKey: PLAN },
});

const element = (id: string, headline: string) => ({
  id,
  type: TSurveyElementTypeEnum.OpenText,
  headline: { default: headline },
  required: false,
  inputType: "text",
  charLimit: { enabled: false },
});

/**
 * Two elements in one block, so an index in the answer is distinguishable from the `-1` / `-2` /
 * element-count sentinels `isUsedInRecall` uses for "nowhere", the welcome card and an ending.
 */
const survey = (overrides: Record<string, unknown> = {}): TSurvey =>
  ({
    id: "survey1",
    welcomeCard: { enabled: false, timeToFinish: false, showResponseCount: false },
    endings: [{ id: "ending1", type: "endScreen", headline: { default: "Thanks" } }],
    followUps: [],
    blocks: [
      {
        id: "block1",
        name: "Block 1",
        elements: [element("q_one", "One?"), element("q_two", "Two?")],
        logic: [],
      },
    ],
    ...overrides,
  }) as unknown as TSurvey;

/** A block whose logic reads the field as its left operand. */
const withLogicOn = (operandType: "hiddenField" | "variable"): TSurvey =>
  survey({
    blocks: [
      {
        id: "block1",
        name: "Block 1",
        elements: [element("q_one", "One?"), element("q_two", "Two?")],
        logic: [
          {
            id: "logic1",
            conditions: {
              id: "group1",
              connector: "and",
              conditions: [
                {
                  id: "condition1",
                  leftOperand: { type: operandType, value: PLAN },
                  operator: "equals",
                  rightOperand: { type: "static", value: "pro" },
                },
              ],
            },
            actions: [],
          },
        ],
      },
    ],
  });

/**
 * A block whose logic *reads* the field as a calculation's input, with a condition that names
 * something else — so only the action can make the lookup match.
 */
const withCalculateReading = (valueType: "hiddenField" | "variable"): TSurvey =>
  survey({
    blocks: [
      {
        id: "block1",
        name: "Block 1",
        elements: [element("q_one", "One?"), element("q_two", "Two?")],
        logic: [
          {
            id: "logic1",
            conditions: {
              id: "group1",
              connector: "and",
              conditions: [
                {
                  id: "condition1",
                  leftOperand: { type: "element", value: "q_one" },
                  operator: "isSubmitted",
                },
              ],
            },
            actions: [
              {
                id: "action1",
                objective: "calculate",
                variableId: "other_var",
                operator: "assign",
                value: { type: valueType, value: PLAN },
              },
            ],
          },
        ],
      },
    ],
  });

const recallToken = `#recall:${PLAN}/fallback:#`;

const quota = (name: string, criteria: Record<string, unknown>): TSurveyQuota =>
  ({
    id: "quota1",
    name,
    limit: 10,
    logic: { connector: "and", conditions: [{ id: "c1", ...criteria }] },
  }) as unknown as TSurveyQuota;

describe("findEmbeddedFieldRemovalBlocker", () => {
  test("lets a field nothing references go", () => {
    expect(findEmbeddedFieldRemovalBlocker(survey(), [], entry("ingested"))).toBeNull();
  });

  /**
   * The source decides which half of the logic namespace is searched, and it has to: a survey can
   * hold a computed and an ingested field at the same address, and a condition names one of them.
   */
  test("finds the field in logic, on the side its source occupies", () => {
    expect(findEmbeddedFieldRemovalBlocker(withLogicOn("hiddenField"), [], entry("ingested"))).toEqual({
      reason: "logic",
      elementIndex: 0,
    });
    expect(findEmbeddedFieldRemovalBlocker(withLogicOn("variable"), [], entry("computed"))).toEqual({
      reason: "logic",
      elementIndex: 0,
    });
  });

  // A calculate action reads an operand as well as writing one. Letting a field go while a
  // calculation still consumes it leaves the action pointing at nothing.
  test("finds a field a calculation reads as its input", () => {
    expect(findEmbeddedFieldRemovalBlocker(withCalculateReading("variable"), [], entry("computed"))).toEqual({
      reason: "logic",
      elementIndex: 0,
    });
    expect(
      findEmbeddedFieldRemovalBlocker(withCalculateReading("hiddenField"), [], entry("ingested"))
    ).toEqual({ reason: "logic", elementIndex: 0 });
  });

  test("does not answer a computed lookup with an ingested field's logic", () => {
    expect(findEmbeddedFieldRemovalBlocker(withLogicOn("hiddenField"), [], entry("computed"))).toBeNull();
  });

  test("finds a recall token in a question, and names the question", () => {
    const withRecall = survey({
      blocks: [
        {
          id: "block1",
          name: "Block 1",
          elements: [element("q_one", "One?"), element("q_two", `Two ${recallToken}?`)],
          logic: [],
        },
      ],
    });

    expect(findEmbeddedFieldRemovalBlocker(withRecall, [], entry("ingested"))).toEqual({
      reason: "recall",
      elementIndex: 1,
    });
  });

  test("tells the welcome card and an ending card apart from a question", () => {
    const inWelcome = survey({
      welcomeCard: { enabled: true, headline: { default: `Hi ${recallToken}` }, timeToFinish: false },
    });
    const inEnding = survey({
      endings: [{ id: "ending1", type: "endScreen", headline: { default: `Bye ${recallToken}` } }],
    });

    expect(findEmbeddedFieldRemovalBlocker(inWelcome, [], entry("ingested"))).toEqual({
      reason: "recallWelcome",
    });
    expect(findEmbeddedFieldRemovalBlocker(inEnding, [], entry("ingested"))).toEqual({
      reason: "recallEnding",
    });
  });

  test("names the quota that still counts on the field", () => {
    const quotas = [quota("Pro users", { leftOperand: { type: "hiddenField", value: PLAN } })];

    expect(findEmbeddedFieldRemovalBlocker(survey(), quotas, entry("ingested"))).toEqual({
      reason: "quota",
      quotaName: "Pro users",
    });
  });

  test("finds a follow-up still addressed to the field", () => {
    const withFollowUp = survey({
      followUps: [{ id: "f1", deleted: false, action: { properties: { to: PLAN } } }],
    });

    expect(findEmbeddedFieldRemovalBlocker(withFollowUp, [], entry("ingested"))).toEqual({
      reason: "followUp",
    });
  });

  test("ignores a deleted follow-up", () => {
    const withDeletedFollowUp = survey({
      followUps: [{ id: "f1", deleted: true, action: { properties: { to: PLAN } } }],
    });

    expect(findEmbeddedFieldRemovalBlocker(withDeletedFollowUp, [], entry("ingested"))).toBeNull();
  });

  // The cascade is ordered, and the order is what the author is told to fix first.
  test("reports logic before recall when both hold the field", () => {
    const both = survey({
      blocks: [
        {
          ...(withLogicOn("hiddenField").blocks[0] as Record<string, unknown>),
          elements: [element("q_one", `One ${recallToken}?`), element("q_two", "Two?")],
        },
      ],
    });

    expect(findEmbeddedFieldRemovalBlocker(both, [], entry("ingested"))).toMatchObject({ reason: "logic" });
  });
});

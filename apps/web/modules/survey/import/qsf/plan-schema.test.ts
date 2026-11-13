import { describe, expect, test } from "vitest";
import { ZQsfImportPlanEnvelope, ZQsfImportPlanForAI, ZQsfPlanQuestion } from "./plan-schema";

describe("ZQsfImportPlanForAI", () => {
  test("fills what a provider leaves out when it omits empty fields", () => {
    // DeepSeek, for one, omits empty arrays and nulls; the checks are what validate content, so the
    // model-facing schema fills them instead of failing the call.
    const plan = ZQsfImportPlanForAI.parse({ questions: [{ ref: "QID1", type: "openText" }] });

    expect(plan.skipped).toEqual([]);
    expect(plan.pages).toEqual([]);
    expect(plan.questions?.[0]).toMatchObject({
      ref: "QID1",
      type: "openText",
      required: false,
      choicesFrom: null,
      rowsFrom: null,
      columnsFrom: null,
      otherChoiceKey: null,
      noneChoiceKey: null,
      labelKey: null,
      excludedKeys: [],
      contactFields: [],
      inputType: null,
      scale: null,
      range: null,
      format: null,
      logicNotes: [],
    });
  });
});

describe("the checks' schemas", () => {
  test("normalise the empty values a JSON-object provider sends", () => {
    const envelope = ZQsfImportPlanEnvelope.parse({ questions: null, skipped: null });
    expect(envelope.questions).toEqual([]);
    expect(envelope.skipped).toEqual([]);

    const question = ZQsfPlanQuestion.parse({
      ref: "QID1",
      type: "rating",
      required: false,
      choicesFrom: null,
      rowsFrom: null,
      columnsFrom: null,
      otherChoiceKey: null,
      noneChoiceKey: null,
      labelKey: null,
      excludedKeys: null,
      contactFields: null,
      inputType: null,
      scale: "number",
      range: 5,
      format: null,
      logicNotes: null,
    });

    expect(question.range).toBe("5");
    expect(question.excludedKeys).toEqual([]);
    expect(question.contactFields).toEqual([]);
    expect(question.logicNotes).toEqual([]);
  });
});

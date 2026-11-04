import { describe, expect, test } from "vitest";
import { ZDocumentImportPlanEnvelope, ZDocumentImportPlanForAI, ZDocumentPlanEntry } from "./plan-schema";

describe("ZDocumentImportPlanForAI", () => {
  test("fills what a provider leaves out when it omits empty fields", () => {
    // DeepSeek, for one, omits empty arrays and nulls; the checks are what validate content, so the
    // model-facing schema fills them instead of failing the call.
    const plan = ZDocumentImportPlanForAI.parse({
      defaultLanguage: "en-US",
      questions: [{ ref: "R1", kind: "openText" }],
    });

    expect(plan.languages).toEqual([]);
    expect(plan.titleCell).toBeNull();
    expect(plan.skipped).toEqual([]);
    expect(plan.questions?.[0]).toMatchObject({
      ref: "R1",
      kind: "openText",
      idCell: null,
      sectionCell: null,
      required: false,
      headline: [],
      subheader: [],
      options: [],
      columns: [],
      lowerLabel: [],
      upperLabel: [],
      dropdown: false,
      inputType: null,
      scale: null,
      range: null,
      format: null,
      rules: [],
      logicNotes: [],
    });
    expect(plan.questions?.[0].headline).toEqual([]);
  });
});

describe("the checks' schemas", () => {
  test("normalise the empty values a JSON-object provider sends", () => {
    const envelope = ZDocumentImportPlanEnvelope.parse({
      defaultLanguage: "en-US",
      languages: null,
      questions: [],
      skipped: null,
    });
    expect(envelope.languages).toEqual([]);
    expect(envelope.skipped).toEqual([]);

    const entry = ZDocumentPlanEntry.parse({
      ref: "R1",
      kind: "rating",
      idCell: null,
      sectionCell: null,
      required: false,
      headline: [],
      subheader: null,
      options: [],
      columns: null,
      lowerLabel: null,
      upperLabel: [],
      dropdown: false,
      inputType: null,
      scale: "number",
      range: 5,
      format: null,
      rules: [],
      logicNotes: null,
    });

    expect(entry.range).toBe("5");
    expect(entry.subheader).toEqual([]);
    expect(entry.columns).toEqual([]);
    expect(entry.lowerLabel).toEqual([]);
    expect(entry.logicNotes).toEqual([]);
  });

  test("take an option without texts and a rule without values as empty, as the model-facing schema does", () => {
    const entry = ZDocumentPlanEntry.parse({
      ref: "R1",
      kind: "multipleChoiceSingle",
      idCell: null,
      sectionCell: null,
      required: false,
      headline: [],
      options: [{ code: null, isOther: true, texts: null }],
      rules: [{ kind: "skipTo", question: "Q1", operator: "isSkipped", values: null, target: "end" }],
      dropdown: false,
      inputType: null,
      scale: null,
      range: null,
      format: null,
    });

    expect(entry.options[0].texts).toEqual([]);
    expect(entry.rules[0].values).toEqual([]);
  });
});

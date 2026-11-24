import { describe, expect, test } from "vitest";
import type { TSurveyLanguage } from "@formbricks/types/surveys/types";
import {
  V3SurveyCreateValidationDocumentNotPreparedError,
  buildV3SurveyCreateInput,
  getV3SurveyCreateInputInvalidParams,
  getV3SurveyCreateInputInvalidParamsForDocument,
} from "./create-input";
import { ZV3CreateSurveyBody } from "./schemas";

const parse = (blocks: unknown[]) =>
  ZV3CreateSurveyBody.parse({
    workspaceId: "clxx1234567890123456789012",
    name: "Survey",
    blocks,
  });

const element = (labels: string[]) => ({
  id: "q1",
  type: "multipleChoiceSingle",
  headline: { "en-US": "Pick" },
  required: false,
  choices: labels.map((label, index) => ({ id: `c${index}`, label: { "en-US": label } })),
});

const languages: TSurveyLanguage[] = [];

describe("buildV3SurveyCreateInput", () => {
  test("maps the document onto the service's create input, overrides last", () => {
    const input = parse([{ name: "Block", elements: [element(["A", "B"])] }]);

    const createInput = buildV3SurveyCreateInput(input, {
      languages,
      createdBy: "user_1",
      overrides: { name: "Overridden", status: "inProgress" },
    });

    expect(createInput).toMatchObject({
      name: "Overridden",
      status: "inProgress",
      type: "link",
      languages,
      questions: [],
      createdBy: "user_1",
      blocks: input.blocks,
    });
  });
  test("carries the multi-language respondent settings through", () => {
    const input = ZV3CreateSurveyBody.parse({
      workspaceId: "clxx1234567890123456789012",
      name: "Survey",
      showLanguageSwitch: true,
      autoSelectLanguage: false,
      blocks: [{ name: "Block", elements: [element(["A", "B"])] }],
    });

    expect(buildV3SurveyCreateInput(input, { languages, createdBy: null })).toMatchObject({
      showLanguageSwitch: true,
      autoSelectLanguage: false,
    });
  });
});

describe("getV3SurveyCreateInputInvalidParams", () => {
  test("is empty for an input the service accepts", () => {
    const input = parse([{ name: "Block", elements: [element(["A", "B"])] }]);

    expect(
      getV3SurveyCreateInputInvalidParams(buildV3SurveyCreateInput(input, { languages, createdBy: null }))
    ).toEqual([]);
  });

  test("names what the service's write schema refuses that the v3 request schema admits", () => {
    const input = parse([{ name: "Block", elements: [element(["Same", "Same"])] }]);

    expect(
      getV3SurveyCreateInputInvalidParams(buildV3SurveyCreateInput(input, { languages, createdBy: null }))
    ).toEqual([expect.objectContaining({ name: "blocks.0.elements.0.choices" })]);
  });
});

describe("getV3SurveyCreateInputInvalidParamsForDocument (ENG-7508)", () => {
  const valid = () => parse([{ name: "Block", elements: [element(["A", "B"])] }]);
  const cta = (buttonUrl: string) => ({
    id: "cta1",
    type: "cta",
    headline: { "en-US": "Call us" },
    required: false,
    buttonExternal: true,
    buttonUrl,
    ctaButtonLabel: { "en-US": "Call" },
  });

  test("is empty for a document the create accepts", () => {
    expect(getV3SurveyCreateInputInvalidParamsForDocument(valid())).toEqual([]);
  });

  // The defect (ENG-7508): the v3 request schema admits these, so the dry run stopped there and called
  // them valid; the create's write schema then answered 422.
  test("reports duplicate choice labels exactly as the create's write schema does", () => {
    const document = parse([{ name: "Block", elements: [element(["Same", "Same"])] }]);

    expect(getV3SurveyCreateInputInvalidParamsForDocument(document)).toEqual([
      expect.objectContaining({
        name: "blocks.0.elements.0.choices",
        reason: "Element 1 in block 1 has duplicate choice labels for the following languages:",
      }),
    ]);
  });

  test("reports a CTA buttonUrl scheme the create refuses", () => {
    const document = parse([{ name: "Block", elements: [cta("tel:+123456789")] }]);

    const invalidParams = getV3SurveyCreateInputInvalidParamsForDocument(document);

    expect(invalidParams).toEqual([
      expect.objectContaining({
        name: "blocks.0.elements.0.buttonUrl",
        reason: "Element 1 in block 1: URL must start with https:// or mailto:",
      }),
    ]);
    // No `code`: the write schema reports both through the refinement, as the create's 422 does.
    expect(invalidParams[0]).not.toHaveProperty("code");
  });

  // A valid document with typed Embedded Data must stay valid: the stand-in ids only have to satisfy
  // the write schema's shape, and the derived legacy columns come from the fields themselves.
  test("keeps a settled Embedded Data field valid, a library link included", () => {
    const document = ZV3CreateSurveyBody.parse({
      workspaceId: "clxx1234567890123456789012",
      name: "Survey",
      blocks: [{ name: "Block", elements: [element(["A", "B"])] }],
      embeddedFields: [
        {
          storageKey: "score",
          key: null,
          name: "score",
          source: "computed",
          dataType: "number",
          defaultValue: 0,
          locked: false,
        },
        {
          storageKey: "plan",
          key: "plan",
          name: "Plan",
          source: "ingested",
          dataType: "string",
          defaultValue: null,
          locked: true,
        },
      ],
    });

    expect(getV3SurveyCreateInputInvalidParamsForDocument(document)).toEqual([]);
  });

  // A caller that skips `prepareV3SurveyCreate` has entries without the storage keys settlement fills
  // in. Dropping them would skip every check they feed, so the helper refuses the document instead.
  test("refuses a document whose Embedded Data was never prepared", () => {
    const document = ZV3CreateSurveyBody.parse({
      workspaceId: "clxx1234567890123456789012",
      name: "Survey",
      blocks: [{ name: "Block", elements: [element(["A", "B"])] }],
      embeddedFields: [{ name: "score", source: "computed" }],
    });

    expect(() => getV3SurveyCreateInputInvalidParamsForDocument(document)).toThrow(
      V3SurveyCreateValidationDocumentNotPreparedError
    );
  });
});

describe("buildV3SurveyCreateInput start logic (ENG-6932)", () => {
  test("carries rules before the first question through, and stores none as null", () => {
    const blocks = [{ id: "clbk1234567890123456789012", name: "Block", elements: [element(["A", "B"])] }];
    const rule = {
      id: "clrule12345678901234567890",
      conditions: { id: "clgrp123456789012345678901", connector: "and", conditions: [] },
      actions: [{ id: "clact123456789012345678901", objective: "jumpToBlock", target: blocks[0].id }],
    };
    const withRules = ZV3CreateSurveyBody.parse({
      workspaceId: "clxx1234567890123456789012",
      name: "Survey",
      blocks,
      startLogic: [rule],
    });

    expect(buildV3SurveyCreateInput(withRules, { languages, createdBy: null }).startLogic).toEqual([rule]);
    expect(buildV3SurveyCreateInput(parse(blocks), { languages, createdBy: null }).startLogic).toBeNull();
  });
});

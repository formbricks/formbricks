import { describe, expect, test } from "vitest";
import type { TSurveyLanguage } from "@formbricks/types/surveys/types";
import { buildV3SurveyCreateInput, getV3SurveyCreateInputInvalidParams } from "./create-input";
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

import { describe, expect, test } from "vitest";
import type { TSurveyLanguage } from "@formbricks/types/surveys/types";
import { buildV3SurveyCreateInput, getV3SurveyCreateInputInvalidParams } from "./create-input";
import { prepareV3SurveyCreateInput } from "./prepare";
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

// ENG-7431: the one-step "set to a metadata value" shape an API or MCP client sends. The evaluators now
// read it; this pins that the create accepts it and hands it to the write schema unchanged.
describe("a one-step Set value from a reserved (metadata) field", () => {
  const action = {
    id: "act1",
    objective: "calculate",
    variableId: "pagesseen",
    operator: "assign",
    value: { type: "reserved", value: "visitPagesViewed" },
  };
  const body = {
    workspaceId: "clxx1234567890123456789012",
    name: "Pages seen",
    variables: [{ id: "pagesseen", name: "pages_seen", type: "number", value: 0 }],
    blocks: [
      {
        name: "Block",
        elements: [element(["A", "B"])],
        logic: [
          {
            id: "logic1",
            conditions: {
              id: "group1",
              connector: "and",
              conditions: [
                {
                  id: "cond1",
                  leftOperand: { type: "element", value: "q1" },
                  operator: "isSubmitted",
                },
              ],
            },
            actions: [action],
          },
        ],
      },
    ],
  };

  test("is accepted by the create and reaches the write input unchanged", () => {
    const prepared = prepareV3SurveyCreateInput(body);
    if (!prepared.ok) throw new Error(JSON.stringify(prepared.validation.invalidParams));

    const createInput = buildV3SurveyCreateInput(prepared.document, { languages, createdBy: null });

    expect(getV3SurveyCreateInputInvalidParams(createInput)).toEqual([]);
    expect(createInput.blocks?.[0].logic?.[0].actions[0]).toMatchObject(action);
  });
});

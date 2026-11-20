import { describe, expect, test } from "vitest";
import { surveyFlowFixture } from "./test-fixtures/survey-flow-fixture";
import { type TSurvey, ZSurvey } from "./types";
import { getSurveyValidationIssueParams } from "./validation-issue-codes";

/**
 * ENG-629: the schema's issues carry a semantic code and the values their message needs, so the
 * editor can translate them. Each case breaks one thing in the shared fixture and expects the code.
 */

const codedIssuesOf = (survey: TSurvey) =>
  (ZSurvey.safeParse(survey).error?.issues ?? []).map((issue) => ({
    path: issue.path.join("."),
    params: getSurveyValidationIssueParams(issue),
  }));

const fixtureWith = (update: (survey: TSurvey) => void): TSurvey => {
  const survey = structuredClone(surveyFlowFixture);
  update(survey);
  return survey;
};

/** The first block of the fixture that has rules, with its position. */
const firstBlockWithRules = (survey: TSurvey) => {
  const blockIndex = survey.blocks.findIndex((block) => block.logic?.length);
  return { blockIndex, block: survey.blocks[blockIndex] };
};

describe("survey validation issue codes", () => {
  test("codes a condition that is missing the value its operator needs", () => {
    let blockIndex = -1;
    const survey = fixtureWith((s) => {
      const found = firstBlockWithRules(s);
      blockIndex = found.blockIndex;
      const condition = found.block.logic![0].conditions.conditions[0] as Record<string, unknown>;
      condition.operator = "equals";
      delete condition.rightOperand;
    });

    expect(codedIssuesOf(survey)).toContainEqual({
      path: `blocks.${String(blockIndex)}.logic.0.conditions.conditions.0.rightOperand`,
      params: { issueCode: "right_operand_required", operator: "equals" },
    });
  });

  test("codes a jump to the rule's own block", () => {
    let blockIndex = -1;
    const survey = fixtureWith((s) => {
      const found = firstBlockWithRules(s);
      blockIndex = found.blockIndex;
      found.block.logic![0].actions = [
        { id: "jumpselfaaaaaaaaaaaaaaaa", objective: "jumpToBlock", target: found.block.id },
      ];
    });

    expect(codedIssuesOf(survey)).toContainEqual({
      path: `blocks.${String(blockIndex)}.logic.0`,
      params: { issueCode: "jump_to_own_block" },
    });
  });

  test("carries the rule number when the path stops at the rule list", () => {
    let blockIndex = -1;
    const survey = fixtureWith((s) => {
      const found = firstBlockWithRules(s);
      blockIndex = found.blockIndex;
      const target = s.endings[0].id;
      found.block.logic![1].actions = [
        { id: "jumponeaaaaaaaaaaaaaaaaa", objective: "jumpToBlock", target },
        { id: "jumptwoaaaaaaaaaaaaaaaaa", objective: "jumpToBlock", target },
      ];
    });

    expect(codedIssuesOf(survey)).toContainEqual({
      path: `blocks.${String(blockIndex)}.logic`,
      params: { issueCode: "multiple_jumps", ruleNumber: 2 },
    });
  });

  test("codes an ending's empty button label", () => {
    const survey = fixtureWith((s) => {
      s.endings = [
        { id: "endingbuttonaaaaaaaaaaaa", type: "endScreen", buttonLink: "https://formbricks.com" },
      ];
    });

    expect(codedIssuesOf(survey)).toContainEqual({
      path: "endings.0.buttonLabel",
      params: { issueCode: "ending_button_label_required" },
    });
  });
});

describe("getSurveyValidationIssueParams", () => {
  test("reads the code and values of a coded issue", () => {
    expect(
      getSurveyValidationIssueParams({
        code: "custom",
        params: { issueCode: "multiple_jumps", ruleNumber: 1 },
      })
    ).toEqual({ issueCode: "multiple_jumps", ruleNumber: 1 });
  });

  test("ignores issues without a known code", () => {
    expect(getSurveyValidationIssueParams({ code: "custom" })).toBeUndefined();
    expect(
      getSurveyValidationIssueParams({ code: "custom", params: { invalidLanguageCodes: ["de"] } })
    ).toBeUndefined();
    expect(
      getSurveyValidationIssueParams({ code: "custom", params: { issueCode: "not_a_code" } })
    ).toBeUndefined();
    expect(
      getSurveyValidationIssueParams({ code: "invalid_type", params: { issueCode: "multiple_jumps" } })
    ).toBeUndefined();
  });
});

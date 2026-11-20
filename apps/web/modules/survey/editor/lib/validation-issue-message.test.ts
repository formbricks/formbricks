import { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { describeSurveyValidationIssue } from "./validation-issue-message";

// Echoes the key and its interpolation values, so each assertion shows exactly what was asked for.
const t = ((key: string, values?: Record<string, unknown>) =>
  values ? `${key} ${JSON.stringify(values)}` : key) as unknown as TFunction;

const blocks = [
  { id: "b1", name: "Intro questions" },
  { id: "b2", name: "  " },
] as unknown as TSurveyBlock[];

const issue = (path: (string | number)[], params?: Record<string, unknown>) => ({
  code: "custom" as const,
  path,
  params,
});

const KEY = "workspace.surveys.edit.validation_issue";

describe("describeSurveyValidationIssue", () => {
  test("returns null for an issue without a code, so the caller keeps its own message", () => {
    expect(describeSurveyValidationIssue(issue(["blocks", 0, "logic", 0]), blocks, t)).toBeNull();
    expect(
      describeSurveyValidationIssue(issue(["blocks", 0], { missingLogicDestination: "jump" }), blocks, t)
    ).toBeNull();
  });

  test("names the operator in the rule builder's words and the rule's block by its title", () => {
    expect(
      describeSurveyValidationIssue(
        issue(["blocks", 0, "logic", 1, "conditions", "conditions", 0, "rightOperand"], {
          issueCode: "right_operand_required",
          operator: "equals",
        }),
        blocks,
        t
      )
    ).toBe(
      `${KEY}.with_location {"location":"${KEY}.location_rule {\\"ruleNumber\\":2,\\"blockName\\":\\"Intro questions\\"}","message":"${KEY}.right_operand_required {\\"operator\\":\\"workspace.surveys.edit.equals\\"}"}`
    );
  });

  test("prefers a worded operator label over a symbol", () => {
    const message = describeSurveyValidationIssue(
      issue(["blocks", 0, "logic", 0], {
        issueCode: "right_operand_must_be_number",
        operator: "isGreaterThan",
      }),
      blocks,
      t
    );
    expect(message).toContain('\\"operator\\":\\">\\"');

    const equals = describeSurveyValidationIssue(
      issue(["blocks", 0, "logic", 0], { issueCode: "right_operand_must_be_number", operator: "equals" }),
      blocks,
      t
    );
    expect(equals).toContain('\\"operator\\":\\"workspace.surveys.edit.equals\\"');
  });

  test("falls back to the block's position when its title is blank, and to the rule number in params", () => {
    expect(
      describeSurveyValidationIssue(
        issue(["blocks", 1, "logic"], { issueCode: "multiple_jumps", ruleNumber: 3 }),
        blocks,
        t
      )
    ).toBe(
      `${KEY}.with_location {"location":"${KEY}.location_rule {\\"ruleNumber\\":3,\\"blockName\\":\\"workspace.surveys.edit.block_n {\\\\\\"blockNumber\\\\\\":2}\\"}","message":"${KEY}.multiple_jumps"}`
    );
  });

  test("names the show-if an issue belongs to", () => {
    expect(
      describeSurveyValidationIssue(
        issue(["blocks", 0, "elements", 2, "choices", 1, "showIf", "conditions", 0], {
          issueCode: "show_if_uses_itself",
        }),
        blocks,
        t
      )
    ).toContain(
      `${KEY}.location_option_show_if {\\"optionNumber\\":2,\\"questionNumber\\":3,\\"blockName\\":\\"Intro questions\\"}`
    );
    expect(
      describeSurveyValidationIssue(
        issue(["blocks", 0, "showIf"], { issueCode: "field_not_found" }),
        blocks,
        t
      )
    ).toContain(`${KEY}.location_block_show_if`);
  });

  test("names endings and follow-ups", () => {
    expect(
      describeSurveyValidationIssue(
        issue(["endings", 1, "url"], { issueCode: "redirect_url_required" }),
        blocks,
        t
      )
    ).toBe(
      `${KEY}.with_location {"location":"${KEY}.location_ending {\\"endingNumber\\":2}","message":"${KEY}.redirect_url_required"}`
    );
    expect(
      describeSurveyValidationIssue(
        issue(["followUps"], { issueCode: "follow_up_no_ending", followUpNumber: 1 }),
        blocks,
        t
      )
    ).toContain(`${KEY}.location_follow_up {\\"followUpNumber\\":1}`);
  });

  test("says which kind of field a condition needs", () => {
    expect(
      describeSurveyValidationIssue(
        issue(["blocks", 0, "logic", 0], { issueCode: "field_type_mismatch", expectedType: "number" }),
        blocks,
        t
      )
    ).toContain(`${KEY}.field_must_be_number`);
    expect(
      describeSurveyValidationIssue(
        issue(["blocks", 0, "logic", 0], { issueCode: "field_type_mismatch", expectedType: "text" }),
        blocks,
        t
      )
    ).toContain(`${KEY}.field_must_be_text`);
  });
});

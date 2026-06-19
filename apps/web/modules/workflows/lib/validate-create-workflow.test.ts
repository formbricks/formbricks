import { describe, expect, test } from "vitest";
import {
  WORKFLOW_DESCRIPTION_MAX_LENGTH,
  WORKFLOW_NAME_MAX_LENGTH,
  validateCreateWorkflowForm,
} from "./validate-create-workflow";

describe("validateCreateWorkflowForm", () => {
  test("is invalid when the name is empty or whitespace-only", () => {
    expect(validateCreateWorkflowForm("", "").isValid).toBe(false);
    expect(validateCreateWorkflowForm("   ", "").isValid).toBe(false);
  });

  test("is valid for a trimmed, in-bounds name with no description", () => {
    const result = validateCreateWorkflowForm("  Response follow-up  ", "");
    expect(result.isValid).toBe(true);
    expect(result.trimmedName).toBe("Response follow-up");
    expect(result.errors).toEqual({ nameTooLong: false, descriptionTooLong: false });
  });

  test("flags a name longer than the max", () => {
    const result = validateCreateWorkflowForm("a".repeat(WORKFLOW_NAME_MAX_LENGTH + 1), "");
    expect(result.errors.nameTooLong).toBe(true);
    expect(result.isValid).toBe(false);
  });

  test("accepts a name exactly at the max", () => {
    expect(validateCreateWorkflowForm("a".repeat(WORKFLOW_NAME_MAX_LENGTH), "").isValid).toBe(true);
  });

  test("flags a description longer than the max but keeps a valid name", () => {
    const result = validateCreateWorkflowForm("Valid", "b".repeat(WORKFLOW_DESCRIPTION_MAX_LENGTH + 1));
    expect(result.errors.descriptionTooLong).toBe(true);
    expect(result.isValid).toBe(false);
  });

  test("accepts a description exactly at the max", () => {
    expect(validateCreateWorkflowForm("Valid", "b".repeat(WORKFLOW_DESCRIPTION_MAX_LENGTH)).isValid).toBe(
      true
    );
  });
});

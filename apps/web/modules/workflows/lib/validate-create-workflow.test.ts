import { describe, expect, test } from "vitest";
import {
  WORKFLOW_DESCRIPTION_MAX_LENGTH,
  WORKFLOW_NAME_MAX_LENGTH,
  getCreateWorkflowFormSchema,
} from "./validate-create-workflow";

// Identity translator: returns the key so assertions stay message-agnostic.
const t = ((key: string) => key) as unknown as Parameters<typeof getCreateWorkflowFormSchema>[0];
const schema = getCreateWorkflowFormSchema(t);

describe("getCreateWorkflowFormSchema", () => {
  test("rejects an empty or whitespace-only name", () => {
    expect(schema.safeParse({ name: "", description: "" }).success).toBe(false);
    expect(schema.safeParse({ name: "   ", description: "" }).success).toBe(false);
  });

  test("accepts a trimmed, in-bounds name with no description", () => {
    const result = schema.safeParse({ name: "  Response follow-up  ", description: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Response follow-up");
    }
  });

  test("rejects a name longer than the max", () => {
    const result = schema.safeParse({ name: "a".repeat(WORKFLOW_NAME_MAX_LENGTH + 1), description: "" });
    expect(result.success).toBe(false);
  });

  test("accepts a name exactly at the max", () => {
    expect(schema.safeParse({ name: "a".repeat(WORKFLOW_NAME_MAX_LENGTH), description: "" }).success).toBe(
      true
    );
  });

  test("rejects a description longer than the max but keeps a valid name", () => {
    const result = schema.safeParse({
      name: "Valid",
      description: "b".repeat(WORKFLOW_DESCRIPTION_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  test("accepts a description exactly at the max", () => {
    expect(
      schema.safeParse({ name: "Valid", description: "b".repeat(WORKFLOW_DESCRIPTION_MAX_LENGTH) }).success
    ).toBe(true);
  });
});

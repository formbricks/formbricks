import { createId } from "@paralleldrive/cuid2";
import { describe, expect, test } from "vitest";
import { ZSegmentCreateInput, ZSegmentFilters, ZSegmentUpdateInput } from "@formbricks/types/segment";

const validFilters = [
  {
    id: createId(),
    connector: null,
    resource: {
      id: createId(),
      root: {
        type: "attribute" as const,
        contactAttributeKey: "email",
      },
      value: "user@example.com",
      qualifier: {
        operator: "equals" as const,
      },
    },
  },
];

describe("segment schema validation", () => {
  test("keeps base segment filters compatible with empty arrays", () => {
    const result = ZSegmentFilters.safeParse([]);

    expect(result.success).toBe(true);
  });

  test("requires at least one filter when creating a segment", () => {
    const result = ZSegmentCreateInput.safeParse({
      environmentId: "environmentId",
      title: "Power users",
      description: "Users with a matching email",
      isPrivate: false,
      filters: [],
      surveyId: "surveyId",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("At least one filter is required");
  });

  test("accepts segment creation with a valid filter", () => {
    const result = ZSegmentCreateInput.safeParse({
      environmentId: "environmentId",
      title: "Power users",
      description: "Users with a matching email",
      isPrivate: false,
      filters: validFilters,
      surveyId: "surveyId",
    });

    expect(result.success).toBe(true);
  });

  test("requires at least one filter when updating a segment", () => {
    const result = ZSegmentUpdateInput.safeParse({
      filters: [],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("At least one filter is required");
  });

  test("accepts segment updates with a valid filter", () => {
    const result = ZSegmentUpdateInput.safeParse({
      filters: validFilters,
    });

    expect(result.success).toBe(true);
  });
});

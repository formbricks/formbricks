import { createId } from "@paralleldrive/cuid2";
import { describe, expect, test } from "vitest";
import { ZV3SurveyCreateBody, ZV3SurveyPatchBody } from "./schemas";

const workspaceId = createId();

function buildCreateBody() {
  return {
    workspaceId,
    name: "Schema Survey",
    blocks: [
      {
        id: createId(),
        name: "Intro",
        elements: [
          {
            id: "question_1",
            type: "openText",
            headline: { default: "How did it go?" },
            required: true,
          },
        ],
      },
    ],
  };
}

describe("v3 survey schemas", () => {
  test("applies public defaults for create requests", () => {
    const result = ZV3SurveyCreateBody.parse(buildCreateBody());

    expect(result.type).toBe("link");
    expect(result.status).toBe("draft");
    expect(result.welcomeCard).toEqual({
      enabled: false,
      timeToFinish: true,
      showResponseCount: false,
    });
    expect(result.endings).toEqual([]);
    expect(result.hiddenFields).toEqual({ enabled: false });
    expect(result.variables).toEqual([]);
  });

  test("rejects unsupported create fields", () => {
    const result = ZV3SurveyCreateBody.safeParse({
      ...buildCreateBody(),
      questions: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
    }
  });

  test("rejects invalid nested block logic on create", () => {
    const missingTarget = createId();
    const result = ZV3SurveyCreateBody.safeParse({
      ...buildCreateBody(),
      blocks: [
        {
          id: createId(),
          name: "Logic block",
          elements: [
            {
              id: "question_1",
              type: "openText",
              headline: { default: "How did it go?" },
              required: true,
            },
          ],
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      type: "element",
                      value: "question_1",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToBlock",
                  target: missingTarget,
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".").includes("blocks"))).toBe(true);
    }
  });

  test("rejects invalid hidden field identifiers", () => {
    const result = ZV3SurveyCreateBody.safeParse({
      ...buildCreateBody(),
      hiddenFields: {
        enabled: true,
        fieldIds: ["userId", "bad field"],
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".").includes("hiddenFields"))).toBe(true);
    }
  });

  test("rejects invalid variable names", () => {
    const result = ZV3SurveyCreateBody.safeParse({
      ...buildCreateBody(),
      variables: [
        {
          id: createId(),
          name: "Bad-Variable",
          type: "text",
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".").includes("variables"))).toBe(true);
    }
  });

  test("accepts strict top-level partial patch requests", () => {
    const result = ZV3SurveyPatchBody.parse({
      name: "Updated name",
      status: "inProgress",
    });

    expect(result).toEqual({
      name: "Updated name",
      status: "inProgress",
    });
  });

  test("rejects immutable patch fields", () => {
    const result = ZV3SurveyPatchBody.safeParse({
      id: createId(),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
    }
  });
});

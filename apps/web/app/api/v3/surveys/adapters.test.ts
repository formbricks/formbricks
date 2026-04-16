import { createId } from "@paralleldrive/cuid2";
import { describe, expect, test } from "vitest";
import { ValidationError } from "@formbricks/types/errors";
import { applyV3SurveyPatch, buildV3SurveyCreateInput, buildV3SurveyPreview } from "./adapters";

const workspaceId = createId();
const surveyId = createId();

function buildCreateBody() {
  return {
    workspaceId,
    name: "Adapter Survey",
    blocks: [
      {
        id: createId(),
        name: "Intro",
        elements: [
          {
            id: "question_1",
            type: "openText",
            headline: { default: "What should we improve?" },
            required: true,
          },
        ],
      },
    ],
  };
}

describe("v3 survey adapters", () => {
  test("buildV3SurveyCreateInput injects defaults and creator identity", () => {
    const result = buildV3SurveyCreateInput(buildCreateBody(), "user_1");

    expect(result.createdBy).toBe("user_1");
    expect(result.type).toBe("link");
    expect(result.status).toBe("draft");
    expect(result.questions).toEqual([]);
    expect(result.followUps).toEqual([]);
    expect(result.hiddenFields).toEqual({ enabled: false });
  });

  test("buildV3SurveyPreview creates a full survey resource candidate", () => {
    const createInput = buildV3SurveyCreateInput(buildCreateBody(), null);
    const survey = buildV3SurveyPreview(workspaceId, createInput, surveyId);

    expect(survey.id).toBe(surveyId);
    expect(survey.environmentId).toBe(workspaceId);
    expect(survey.createdBy).toBeNull();
    expect(survey.name).toBe("Adapter Survey");
    expect(survey.questions).toEqual([]);
  });

  test("buildV3SurveyCreateInput throws for invalid create payloads", () => {
    expect(() =>
      buildV3SurveyCreateInput(
        {
          ...buildCreateBody(),
          blocks: [],
        } as any,
        "user_1"
      )
    ).toThrow(ValidationError);
  });

  test("buildV3SurveyPreview throws when the generated survey candidate is invalid", () => {
    expect(() =>
      buildV3SurveyPreview(
        workspaceId,
        {
          ...buildV3SurveyCreateInput(buildCreateBody(), "user_1"),
          blocks: [],
        } as any,
        surveyId
      )
    ).toThrow(ValidationError);
  });

  test("applyV3SurveyPatch replaces nested subtrees and preserves omitted top-level fields", () => {
    const currentSurvey = buildV3SurveyPreview(
      workspaceId,
      buildV3SurveyCreateInput(
        {
          ...buildCreateBody(),
          welcomeCard: {
            enabled: true,
            headline: { default: "Welcome" },
          },
        },
        "user_1"
      ),
      surveyId
    );

    const updatedSurvey = applyV3SurveyPatch(currentSurvey, {
      name: "Patched Survey",
      welcomeCard: {
        enabled: false,
      },
    });

    expect(updatedSurvey.name).toBe("Patched Survey");
    expect(updatedSurvey.status).toBe(currentSurvey.status);
    expect(updatedSurvey.blocks).toEqual(currentSurvey.blocks);
    expect(updatedSurvey.welcomeCard).toEqual({
      enabled: false,
      timeToFinish: true,
      showResponseCount: false,
    });
  });

  test("applyV3SurveyPatch throws when a patch would make the survey invalid", () => {
    const currentSurvey = buildV3SurveyPreview(
      workspaceId,
      buildV3SurveyCreateInput(buildCreateBody(), "user_1"),
      surveyId
    );

    expect(() => applyV3SurveyPatch(currentSurvey, { blocks: [] })).toThrow(ValidationError);
  });
});

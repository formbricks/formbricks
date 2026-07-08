import { describe, expect, test } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import type { TWorkflowEmailAuthoringContext } from "@/modules/workflows/types/email-authoring-context";
import { resolveBoundTriggerSurvey } from "./bound-survey";

const definitionWithSurvey = (surveyId: string): TWorkflowDefinition =>
  ({
    schemaVersion: 1,
    entryNodeId: "trigger-1",
    trigger: {
      id: "trigger-1",
      type: "trigger",
      triggerType: "response.completed",
      config: { surveyId, endingCardIds: [] },
    },
    nodes: [],
    edges: [],
  }) as unknown as TWorkflowDefinition;

const contextWithSurvey = (surveyId: string | null): TWorkflowEmailAuthoringContext =>
  ({
    survey: surveyId ? ({ id: surveyId } as TSurvey) : null,
    teamMemberDetails: [],
    userEmail: "",
    mailFrom: "noreply@example.com",
    locale: "en-US",
  }) as TWorkflowEmailAuthoringContext;

describe("resolveBoundTriggerSurvey", () => {
  test("returns the context survey when it matches the trigger surveyId", () => {
    const survey = resolveBoundTriggerSurvey(contextWithSurvey("survey-1"), definitionWithSurvey("survey-1"));
    expect(survey?.id).toBe("survey-1");
  });

  test("returns null when the trigger points at a different survey (stale context)", () => {
    expect(
      resolveBoundTriggerSurvey(contextWithSurvey("survey-1"), definitionWithSurvey("survey-2"))
    ).toBeNull();
  });

  test("returns null when the context has no survey (seed placeholder / deleted survey)", () => {
    expect(resolveBoundTriggerSurvey(contextWithSurvey(null), definitionWithSurvey("survey-1"))).toBeNull();
  });

  test("returns null without a context or definition", () => {
    expect(resolveBoundTriggerSurvey(null, definitionWithSurvey("survey-1"))).toBeNull();
    expect(resolveBoundTriggerSurvey(contextWithSurvey("survey-1"), null)).toBeNull();
  });
});

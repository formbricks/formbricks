import { describe, expect, test } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { surveyToV3Distribution, surveyToV3Targeting, v3DistributionToScalars } from "./distribution";
import type { TV3SurveyDistribution } from "./schemas";

const appSurvey = {
  type: "app",
  displayOption: "respondMultiple",
  displayPercentage: 25,
  displayLimit: 3,
  recontactDays: 7,
  autoClose: 30,
  keepEndingCardOpen: true,
  autoComplete: 100,
  delay: 5,
  triggers: [{ actionClass: { id: "claa1234567890123456789012" } }],
  segment: { id: "seg_1", filters: [] },
} as unknown as TSurvey;

describe("surveyToV3Distribution", () => {
  test("maps stored scalars and triggers to the public shape", () => {
    expect(surveyToV3Distribution(appSurvey)).toEqual({
      displayOption: "respondMultiple",
      displayPercentage: 25,
      displayLimit: 3,
      recontactDays: 7,
      autoClose: 30,
      keepEndingCardOpen: true,
      autoComplete: 100,
      delay: 5,
      showConditions: null,
      triggers: [{ actionClassId: "claa1234567890123456789012" }],
    });
  });

  test("returns stored show conditions as they are", () => {
    const showConditions = {
      id: "grp1",
      connector: "and",
      conditions: [
        {
          id: "cnd1",
          leftOperand: { type: "visit", value: "pagesViewed" },
          operator: "isGreaterThanOrEqual",
          rightOperand: { type: "static", value: 3 },
        },
      ],
    };

    expect(
      surveyToV3Distribution({ ...appSurvey, showConditions } as unknown as TSurvey).showConditions
    ).toEqual(showConditions);
  });

  test("leaves out a condition a draft has not filled in yet", () => {
    const showConditions = {
      id: "grp1",
      connector: "and",
      conditions: [{ id: "cnd1", leftOperand: { type: "visit", value: "pagesViewed" }, operator: "equals" }],
    };

    expect(
      surveyToV3Distribution({ ...appSurvey, showConditions } as unknown as TSurvey).showConditions
    ).toBeNull();
  });

  test("clamps legacy out-of-bounds values to schema-valid ones so reconstruction never fails", () => {
    const legacy = {
      ...appSurvey,
      autoComplete: 0,
      displayPercentage: 150,
      displayLimit: -1,
      recontactDays: -3,
      autoClose: -10,
      delay: -5,
    } as unknown as TSurvey;

    expect(surveyToV3Distribution(legacy)).toMatchObject({
      autoComplete: null,
      displayPercentage: null,
      displayLimit: null,
      recontactDays: null,
      autoClose: null,
      delay: 0,
    });
  });
});

describe("v3DistributionToScalars", () => {
  test("returns the scalar columns and drops triggers", () => {
    const distribution: TV3SurveyDistribution = {
      displayOption: "displaySome",
      displayPercentage: 50,
      displayLimit: null,
      recontactDays: null,
      autoClose: null,
      keepEndingCardOpen: false,
      autoComplete: null,
      delay: 0,
      showConditions: null,
      triggers: [{ actionClassId: "claa1234567890123456789012" }],
    };

    const scalars = v3DistributionToScalars(distribution);

    expect(scalars).not.toHaveProperty("triggers");
    expect(scalars).toEqual({
      displayOption: "displaySome",
      displayPercentage: 50,
      displayLimit: null,
      recontactDays: null,
      autoClose: null,
      keepEndingCardOpen: false,
      autoComplete: null,
      delay: 0,
      showConditions: null,
    });
  });
});

describe("surveyToV3Targeting", () => {
  test("returns empty filters when the survey has no segment", () => {
    expect(surveyToV3Targeting({ segment: null } as unknown as TSurvey)).toEqual({ filters: [] });
  });

  test("returns the segment filters verbatim", () => {
    const filters = [
      {
        id: "clf01234567890123456789012",
        connector: null,
        resource: {
          id: "clf11234567890123456789012",
          root: { type: "attribute", contactAttributeKey: "plan" },
          qualifier: { operator: "equals" },
          value: "pro",
        },
      },
    ];

    expect(surveyToV3Targeting({ segment: { id: "seg_1", filters } } as unknown as TSurvey)).toEqual({
      filters,
    });
  });
});

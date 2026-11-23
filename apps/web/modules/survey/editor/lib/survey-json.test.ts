import { buildSavedSurvey } from "./__mocks__/saved-survey.mock";
import { describe, expect, test } from "vitest";
import { ZSurvey } from "@formbricks/types/surveys/types";
import { isDeepEqualIgnoringUndefined } from "@/lib/utils/object";
import { reviveSurveyBodyDates, reviveSurveyDates } from "./survey-json";

/** The survey as a save route sends and receives it: through JSON, which turns its dates into strings. */
const overJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe("reviveSurveyDates", () => {
  test("gives back every date a saved survey carries, nested ones included", () => {
    const survey = buildSavedSurvey();

    const revived = reviveSurveyDates(overJson(survey));

    expect(revived.createdAt).toEqual(survey.createdAt);
    expect(revived.updatedAt).toEqual(survey.updatedAt);
    expect(revived.visibilityChangedAt).toEqual(survey.visibilityChangedAt);
    expect(revived.publishOn).toEqual(survey.publishOn);
    expect(revived.closeOn).toEqual(survey.closeOn);
    expect(revived.languages[0].language.createdAt).toEqual(survey.languages[0].language.createdAt);
    expect(revived.triggers[0].actionClass.updatedAt).toEqual(survey.triggers[0].actionClass.updatedAt);
    expect(revived.segment?.createdAt).toEqual(survey.segment?.createdAt);
    expect(revived.followUps[0].updatedAt).toEqual(survey.followUps[0].updatedAt);
    // Nothing else JSON loses is left over: the round trip reads as the same survey.
    expect(isDeepEqualIgnoringUndefined(revived, survey)).toBe(true);
  });

  test("revives an archived survey's archivedAt", () => {
    const archivedAt = new Date("2026-10-30T10:00:00.000Z");

    expect(reviveSurveyDates(overJson(buildSavedSurvey({ archivedAt }))).archivedAt).toEqual(archivedAt);
  });
});

describe("reviveSurveyBodyDates", () => {
  test("lets a survey sent as JSON pass ZSurvey, which reads its dates with z.date()", () => {
    const body = overJson(buildSavedSurvey());

    expect(ZSurvey.safeParse(body).success).toBe(false);
    expect(ZSurvey.safeParse(reviveSurveyBodyDates(body)).success).toBe(true);
  });
});

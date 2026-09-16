import { describe, expect, test } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { hasUnsavedSurveyChanges } from "./unsaved-changes";

const baseSurvey = {
  id: "survey_1",
  name: "My survey",
  status: "draft",
  publishOn: null,
  closeOn: null,
  displayPercentage: null,
  segment: null,
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
} as unknown as TSurvey;

const surveyWith = (overrides: Record<string, unknown>): TSurvey =>
  ({ ...baseSurvey, ...overrides }) as unknown as TSurvey;

describe("hasUnsavedSurveyChanges", () => {
  test("reads clean when the editor matches the survey prop", () => {
    expect(hasUnsavedSurveyChanges(surveyWith({}), [baseSurvey])).toBe(false);
  });

  test("ignores updatedAt, which every write moves", () => {
    const local = surveyWith({ updatedAt: new Date("2026-03-01T00:00:00.000Z") });

    expect(hasUnsavedSurveyChanges(local, [baseSurvey])).toBe(false);
  });

  // The reported bug. A draft save sets `localSurvey` from the action's response and then
  // `router.refresh()` re-reads the same survey into the `survey` prop; the two disagree with zero
  // user edits, so comparing against the prop alone warned about work that was already saved.
  test("reads clean against the saved response even when the refreshed prop disagrees", () => {
    const savedResponse = surveyWith({ publishOn: null });
    const refreshedProp = surveyWith({ publishOn: new Date("2026-02-01T00:00:00.000Z") });
    const local = surveyWith({ publishOn: null });

    expect(hasUnsavedSurveyChanges(local, [refreshedProp, savedResponse])).toBe(false);
    // Drop the saved response and the same state reads dirty again — that is the old behaviour.
    expect(hasUnsavedSurveyChanges(local, [refreshedProp])).toBe(true);
  });

  test("still warns on an edit made after the save", () => {
    const savedResponse = surveyWith({ name: "My survey" });
    const local = surveyWith({ name: "My survey (edited)" });

    expect(hasUnsavedSurveyChanges(local, [baseSurvey, savedResponse])).toBe(true);
  });

  test("skips persisted states that are not there yet", () => {
    expect(hasUnsavedSurveyChanges(baseSurvey, [null, undefined, baseSurvey])).toBe(false);
    expect(hasUnsavedSurveyChanges(baseSurvey, [null, undefined])).toBe(true);
  });
});

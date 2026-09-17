import { describe, expect, test } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { hasUnsavedSurveyChanges, serverOwnedChanges } from "./unsaved-changes";

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

/** One Embedded Data entry, as the editor holds it and as a save returns it. */
const linkedField = (overrides: Record<string, unknown> = {}) => ({
  field: {
    id: "row_1",
    key: "plan_tier",
    name: "Plan tier",
    source: "ingested",
    dataType: "string",
    defaultValue: "free",
    locked: false,
    ...overrides,
  },
  link: { storageKey: "plan_tier" },
});

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

/**
 * The auto-save loop (ENG-3266). A draft saves every ten seconds while the dirty check says so, and
 * the check compares the working copy against what the last save returned — so any key the server
 * rewrites is a difference the editor cannot reach on its own, and it writes forever with no user
 * edit behind it.
 */
describe("serverOwnedChanges", () => {
  test("nothing to adopt when the save returned what was sent", () => {
    const local = surveyWith({ embeddedFields: [linkedField()] });
    const saved = surveyWith({ embeddedFields: [linkedField()] });

    expect(serverOwnedChanges(local, saved)).toBeNull();
    expect(hasUnsavedSurveyChanges(local, [saved])).toBe(false);
  });

  test("adopting the rewritten Embedded Data rows settles the dirty check", () => {
    // What a survey linking a library field gets back: the re-read runs after the reconcile, so it
    // carries the row id and library key the payload could not know (ENG-3228).
    const local = surveyWith({ embeddedFields: [linkedField({ id: undefined })] });
    const saved = surveyWith({ embeddedFields: [linkedField()] });

    expect(hasUnsavedSurveyChanges(local, [saved])).toBe(true);

    const adopted = serverOwnedChanges(local, saved);
    expect(adopted).toEqual({ embeddedFields: saved.embeddedFields });
    expect(hasUnsavedSurveyChanges({ ...local, ...adopted }, [saved])).toBe(false);
  });

  test("adopts the legacy columns, which the server derives rather than reads", () => {
    // `variables` and `hiddenFields` are no longer sent: the editor forwards whatever it mounted
    // with and the server derives both from the rows (`toLegacyEmbeddedFields`, ENG-2628).
    const local = surveyWith({ hiddenFields: { enabled: false, fieldIds: [] }, variables: [] });
    const saved = surveyWith({
      hiddenFields: { enabled: true, fieldIds: ["plan_tier"] },
      variables: [{ id: "v1", name: "score", type: "number", value: 0 }],
    });

    expect(serverOwnedChanges(local, saved)).toEqual({
      hiddenFields: saved.hiddenFields,
      variables: saved.variables,
    });
  });

  test("keeps the segment case it generalises", () => {
    const local = surveyWith({ segment: { id: "temp" } });
    const saved = surveyWith({ segment: null });

    expect(serverOwnedChanges(local, saved)).toEqual({ segment: null });
  });

  test("leaves the author's own edits alone", () => {
    // Only the four server-owned keys are adopted; everything else the editor owns outright, so a
    // save that raced a rename must not hand the old name back.
    const local = surveyWith({ name: "Renamed", embeddedFields: [linkedField()] });
    const saved = surveyWith({ name: "My survey", embeddedFields: [linkedField()] });

    expect(serverOwnedChanges(local, saved)).toBeNull();
  });
});

import { describe, expect, test } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { hasUnsavedSurveyChanges, isJustSavedBypassValid } from "./unsaved-changes";

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

/** As the Hidden Fields card builds one: no `id`, because the database assigns that on the write. */
const ingestedRow = (storageKey: string) => ({
  field: {
    name: storageKey,
    source: "ingested" as const,
    dataType: "string" as const,
    defaultValue: null,
    locked: false,
    key: null,
  },
  link: { storageKey },
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

  // ENG-2628. The cards build a row with no `id` — the database assigns it — and they no longer
  // touch `variables` / `hiddenFields`, which the server derives from the rows. `isDeepEqual` fails
  // on a differing key count alone, so without normalizing both the draft auto-save would re-save
  // every tick and the discard dialog would fire on a fully saved survey.
  test("a field the cards just added reads clean once the save returns it", () => {
    const local = surveyWith({
      embeddedFields: [ingestedRow("plan")],
      variables: [],
      hiddenFields: { enabled: false, fieldIds: [] },
    });
    const savedResponse = surveyWith({
      embeddedFields: [{ ...ingestedRow("plan"), field: { ...ingestedRow("plan").field, id: "clx_row_1" } }],
      variables: [],
      hiddenFields: { enabled: true, fieldIds: ["plan"] },
    });

    expect(hasUnsavedSurveyChanges(local, [savedResponse])).toBe(false);
  });

  test("an edit to the rows themselves still reads dirty", () => {
    const savedResponse = surveyWith({
      embeddedFields: [{ ...ingestedRow("plan"), field: { ...ingestedRow("plan").field, id: "clx_row_1" } }],
    });
    const renamed = surveyWith({
      embeddedFields: [
        { ...ingestedRow("plan"), field: { ...ingestedRow("plan").field, name: "Plan tier" } },
      ],
    });

    expect(hasUnsavedSurveyChanges(renamed, [savedResponse])).toBe(true);
  });

  test("skips persisted states that are not there yet", () => {
    expect(hasUnsavedSurveyChanges(baseSurvey, [null, undefined, baseSurvey])).toBe(false);
    expect(hasUnsavedSurveyChanges(baseSurvey, [null, undefined])).toBe(true);
  });
});

describe("isJustSavedBypassValid", () => {
  test("holds while the save it was set by is still what the editor holds", () => {
    expect(isJustSavedBypassValid(true, false)).toBe(true);
  });

  test("is not set at all before a save", () => {
    expect(isJustSavedBypassValid(false, false)).toBe(false);
    expect(isJustSavedBypassValid(false, true)).toBe(false);
  });

  /**
   * The reported sequence: an autosave succeeds and sets the bypass, the user types again, the tab
   * hits a stale action and they click Reload. Without this the bypass is still set, the unload guard
   * returns early, and the edit made after the autosave is discarded with no warning (ENG-2330).
   */
  test("retires once the editor is dirty again after the save", () => {
    const savedByAutosave = surveyWith({ name: "My survey" });
    const editedAfterwards = surveyWith({ name: "My survey (edited)" });

    const isDirtyAgain = hasUnsavedSurveyChanges(editedAfterwards, [baseSurvey, savedByAutosave]);

    expect(isDirtyAgain).toBe(true);
    expect(isJustSavedBypassValid(true, isDirtyAgain)).toBe(false);
  });
});

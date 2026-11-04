import { type TEmbeddedFieldsSurvey, getIngestedStorageKeys } from "@formbricks/types/embedded-data-fields";

/**
 * The editor preview's "Test values" (ENG-6932, P15/T27): values for the survey's URL parameters and
 * hidden fields, typed in the editor and passed to the preview as `hiddenFieldsRecord`, so rules
 * before the first question — a screener — can be tried in place. The renderer applies the same
 * ingest contract to them as to a real link's query string.
 */

/** The fields a test value can be given for: the survey's ingested fields, by storage key. */
export const getTestValueFields = (survey: TEmbeddedFieldsSurvey): string[] => getIngestedStorageKeys(survey);

/** The record the preview gets: filled-in values only, for fields the survey still has. */
export const toHiddenFieldsRecord = (
  values: Record<string, string>,
  fields: readonly string[]
): Record<string, string> =>
  Object.fromEntries(
    fields.flatMap((field) => {
      const value = values[field];
      return value !== undefined && value.trim() !== "" ? [[field, value]] : [];
    })
  );

/**
 * A key that changes when, and only when, the values do. The preview is keyed by it: the rules
 * before the first question run once, when the survey loads, so new values need a fresh start.
 */
export const getTestValuesKey = (record: Record<string, string>): string =>
  Object.keys(record)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(record[key])}`)
    .join("&");

/**
 * The preview's key: it starts over when the test values or the rules before the first question
 * change, so what the preview opens on is what the live survey would open on with those values.
 * `run` counts the restarts after a finish: each one remounts the survey, so the rules before the
 * first question and the first page's show-if run again, as for a new respondent.
 */
export const getPreviewStartKey = (
  record: Record<string, string>,
  startLogic: readonly unknown[],
  run = 0
): string => `${getTestValuesKey(record)}|${JSON.stringify(startLogic)}|${String(run)}`;

/**
 * Whether the preview starts over by itself when the survey finishes: an app survey with no ending
 * has nothing to show at the end, so the preview reopens it from the start.
 */
export const restartsPreviewOnFinish = (survey: { type: string; endings: readonly unknown[] }): boolean =>
  survey.type === "app" && survey.endings.length === 0;

import type { TEmbeddedDataType } from "@formbricks/types/embedded-data";
import {
  type TEmbeddedFieldsSurvey,
  getIngestedEmbeddedFields,
} from "@formbricks/types/embedded-data-fields";
import { formatLocalDay, parseStoredDay } from "@/lib/utils/datetime";

/**
 * The editor preview's "Test values" (ENG-6932, P15/T27): values for the survey's URL parameters and
 * hidden fields, typed in the editor and passed to the preview as `hiddenFieldsRecord`, so rules
 * before the first question — a screener — can be tried in place. The renderer applies the same
 * ingest contract to them as to a real link's query string.
 */

/** A field a test value can be given for: its storage key (the `?key=` of a link) and its type. */
export interface TTestValueField {
  key: string;
  dataType: TEmbeddedDataType;
  /** The page address (`withPageUrlField`), which the preview passes as the page, not as a field. */
  isPageUrl?: boolean;
}

/** The fields a test value can be given for: the survey's ingested fields, in order, with their type. */
export const getTestValueFields = (survey: TEmbeddedFieldsSurvey): TTestValueField[] =>
  getIngestedEmbeddedFields(survey).map(({ field, link }) => ({
    key: link.storageKey,
    dataType: field.dataType,
  }));

/** The value the date picker writes: the picked day in the author's own calendar, as `yyyy-MM-dd`. */
export const toTestDateValue = (date: Date): string => formatLocalDay(date);

/**
 * One draft value as a real `?key=` link would carry it for a field of this type, or `undefined`
 * when there is nothing such a link could carry: blank, or a value the type cannot read (kept from
 * before the field's type changed). The renderer's ingest contract then reads it exactly as it reads
 * a query string, so the preview behaves like the live link.
 *
 * - `string`: as typed, surrounding spaces included, as a link would carry them.
 * - `number`: the number, written plainly (`" 4711.50 "` → `"4711.5"`).
 * - `boolean`: `true` or `false`, the spelling the field's type reads.
 * - `date`: the day as `yyyy-MM-dd`, the date-only form an Embedded Data date takes.
 */
const toLinkValue = (raw: string | undefined, dataType: TEmbeddedDataType): string | undefined => {
  if (raw === undefined || raw.trim() === "") return undefined;
  switch (dataType) {
    case "string":
      return raw;
    case "number": {
      const parsed = Number(raw.trim());
      return Number.isFinite(parsed) ? String(parsed) : undefined;
    }
    case "boolean":
      return raw === "true" || raw === "false" ? raw : undefined;
    case "date": {
      // A whole, real day only: `parseStoredDay` alone accepts a day followed by any time part.
      const day = parseStoredDay(raw);
      return day && toTestDateValue(day) === raw ? raw : undefined;
    }
  }
};

/**
 * The values the preview runs with, in the fields' order, as `[key, value]` pairs: filled-in values
 * only, for fields the survey still has, each in the format its link would carry.
 */
export const getTestValueEntries = (
  values: Record<string, string>,
  fields: readonly TTestValueField[]
): [string, string][] =>
  fields.flatMap(({ key, dataType }): [string, string][] => {
    const value = toLinkValue(values[key], dataType);
    return value === undefined ? [] : [[key, value]];
  });

/**
 * The values for the "Previewing with …" strip (ENG-6969 T13 ②), as they go into the link:
 * "panel_id = 4711 and seg = heavy", joined the way the app's language joins a list.
 */
export const formatTestValuesList = (entries: readonly [string, string][], locale: string): string =>
  new Intl.ListFormat(locale, { type: "conjunction" }).format(
    entries.map(([key, value]) => `${key} = ${value}`)
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

/**
 * The page address as a test value (review of ENG-6969): a rule that reads `url` would otherwise
 * read the editor's own address, which no rule expects. The preview hands it to the renderer as the
 * page address (`previewPageUrl`), not as a hidden field.
 */
export const PAGE_URL_TEST_VALUE_KEY = "url";

/** Whether anything in the survey reads the reserved `url` field: a rule, a show-if, start logic. */
const readsPageUrl = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(readsPageUrl);
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.type === "reserved" && record.value === PAGE_URL_TEST_VALUE_KEY) return true;
  return Object.values(record).some(readsPageUrl);
};

/**
 * The Test values fields with the page address added when a rule reads `url` and no field of the
 * survey already goes by that name (a field named `url` shadows the reserved one).
 */
export const withPageUrlField = (
  fields: readonly TTestValueField[],
  survey: { startLogic?: unknown; blocks: unknown }
): TTestValueField[] =>
  readsPageUrl([survey.startLogic, survey.blocks]) &&
  !fields.some((field) => field.key === PAGE_URL_TEST_VALUE_KEY)
    ? [...fields, { key: PAGE_URL_TEST_VALUE_KEY, dataType: "string", isPageUrl: true }]
    : [...fields];

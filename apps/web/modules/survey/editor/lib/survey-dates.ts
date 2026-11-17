import type { TSurvey } from "@formbricks/types/surveys/types";

/**
 * Whether `value` is a Date object from any JavaScript realm. `instanceof Date` is not enough: it only
 * recognises Dates built by the page's current `Date` constructor.
 */
const isAnyRealmDate = (value: unknown): value is Date =>
  Object.prototype.toString.call(value) === "[object Date]";

/** The same instant as a Date built by this page's `Date`, or `value` untouched when it is not a Date. */
const toPageDate = <T>(value: T): T => {
  if (value instanceof Date || !isAnyRealmDate(value)) return value;
  return new Date(value) as T;
};

type TDated = { createdAt: Date; updatedAt: Date };

const withPageTimestamps = <T extends TDated>(record: T): T => ({
  ...record,
  createdAt: toPageDate(record.createdAt),
  updatedAt: toPageDate(record.updatedAt),
});

/**
 * Rebuilds every date field `ZSurvey` validates as a Date of this page's `Date` constructor (ENG-6768).
 *
 * The editor's working copy is made with `structuredClone`, and so are some of its parts (the
 * targeting card clones the segment). `structuredClone` always returns the engine's built-in Date,
 * while `z.date()` and the server action's serializer both test `instanceof Date` against whatever
 * `globalThis.Date` is at that moment. Where a script or browser extension has replaced
 * `globalThis.Date` (time-zone switchers and anti-fingerprinting tools do), every cloned date fails
 * that test: `ZSurvey` refuses the survey with "Invalid input: expected date, received Date", naming
 * no field, and Activate and Schedule both stop there. Rebuilding the dates from their timestamps
 * keeps the same instants and passes the check in any page.
 *
 * Only the date fields change, so nothing else about the survey being sent is affected. An Invalid
 * Date stays invalid and is still refused.
 */
export const withPageDates = <T extends TSurvey>(survey: T): T => ({
  ...survey,
  createdAt: toPageDate(survey.createdAt),
  updatedAt: toPageDate(survey.updatedAt),
  visibilityChangedAt: toPageDate(survey.visibilityChangedAt),
  publishOn: toPageDate(survey.publishOn),
  closeOn: toPageDate(survey.closeOn),
  ...(survey.archivedAt === undefined ? {} : { archivedAt: toPageDate(survey.archivedAt) }),
  triggers: survey.triggers.map((trigger) => ({
    ...trigger,
    actionClass: withPageTimestamps(trigger.actionClass),
  })),
  segment: survey.segment ? withPageTimestamps(survey.segment) : survey.segment,
  languages: survey.languages.map((surveyLanguage) => ({
    ...surveyLanguage,
    language: withPageTimestamps(surveyLanguage.language),
  })),
  followUps: survey.followUps.map(withPageTimestamps),
});

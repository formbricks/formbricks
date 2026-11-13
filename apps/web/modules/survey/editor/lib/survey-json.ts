import type { TSurvey } from "@formbricks/types/surveys/types";
import { type TJsonDateShape, reviveDates } from "@/modules/api/lib/json-timestamps";

/**
 * Every date a survey carries, as the editor's save routes send and take it
 * (`PUT /api/internal/surveys/{surveyId}` and `/draft`): the survey's own, and those of the rows it loads
 * with it — each language, each trigger's action class, the segment and each follow-up. JSON turns them
 * all into ISO strings; `ZSurvey` reads them with `z.date()`, and the editor compares them as `Date`s.
 *
 * A date added to `TSurvey` belongs here too, or the editor's dirty check sees a string where it saved a
 * `Date` and autosaves forever. `survey-json.test.ts` round-trips a survey with every one of them set.
 */
export const SURVEY_JSON_DATES = {
  createdAt: true,
  updatedAt: true,
  visibilityChangedAt: true,
  publishOn: true,
  closeOn: true,
  archivedAt: true,
  languages: [{ language: { createdAt: true, updatedAt: true } }],
  triggers: [{ actionClass: { createdAt: true, updatedAt: true } }],
  segment: { createdAt: true, updatedAt: true },
  followUps: [{ createdAt: true, updatedAt: true }],
} as const satisfies TJsonDateShape;

/**
 * A survey body with its dates revived, for a save route's schema to read. Untyped on purpose: it runs
 * before the schema, on whatever the caller sent.
 */
export const reviveSurveyBodyDates = (body: unknown): unknown => reviveDates(body, SURVEY_JSON_DATES);

/**
 * A survey as a save route answers it, with its dates back as `Date`s, so the editor keeps the types the
 * page rendered it with. The route serializes a `TSurvey`, so the cast only restores what JSON took away.
 */
export const reviveSurveyDates = <TSaved extends TSurvey>(json: unknown): TSaved =>
  reviveDates(json, SURVEY_JSON_DATES) as TSaved;

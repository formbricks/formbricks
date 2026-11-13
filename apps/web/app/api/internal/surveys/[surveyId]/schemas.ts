import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZSurvey } from "@formbricks/types/surveys/types";
import {
  checkEntriesMax,
  checkNumberRange,
  checkStringMax,
  isPlainRecord,
} from "@/app/api/internal/lib/value-bounds";
import { reviveSurveyBodyDates } from "@/modules/survey/editor/lib/survey-json";
import { ZSurveyDraft } from "@/modules/survey/editor/types/survey";
import {
  SURVEY_SAVE_MAX_INT_COLUMN,
  SURVEY_SAVE_MAX_NUMBER,
  SURVEY_SAVE_MAX_OBJECT_KEYS,
  SURVEY_SAVE_MAX_STRING_LENGTH,
} from "./lib/limits";

export const ZSurveySaveParams = z.object({ surveyId: ZId }).strict();

/** The survey's integer columns, which a value past Postgres `integer` would fail to write. */
const INT_COLUMNS = ["autoClose", "autoComplete", "delay", "displayLimit", "recontactDays"] as const;

type TPath = (string | number)[];

/**
 * Bounds every string, object and number in the survey (`./lib/limits.ts`), stopping at the first value
 * past its cap: one issue names the field and the limit, and a body of a million oversized values costs no
 * more than one. Recursive, which the wrapper's depth cap (`V3_REQUEST_MAX_DEPTH`) keeps shallow.
 */
const checkSurveyValues = (value: unknown, path: TPath, ctx: z.RefinementCtx): boolean => {
  if (typeof value === "string") {
    if (value.length <= SURVEY_SAVE_MAX_STRING_LENGTH) return true;
    checkStringMax(ctx, value, SURVEY_SAVE_MAX_STRING_LENGTH, path);
    return false;
  }
  if (typeof value === "number") {
    if (Number.isFinite(value) && Math.abs(value) <= SURVEY_SAVE_MAX_NUMBER) return true;
    checkNumberRange(ctx, value, { min: -SURVEY_SAVE_MAX_NUMBER, max: SURVEY_SAVE_MAX_NUMBER }, path);
    return false;
  }
  if (Array.isArray(value)) {
    return value.every((item, index) => checkSurveyValues(item, [...path, index], ctx));
  }
  if (isPlainRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length > SURVEY_SAVE_MAX_OBJECT_KEYS) {
      checkEntriesMax(ctx, value, SURVEY_SAVE_MAX_OBJECT_KEYS, path);
      return false;
    }
    return entries.every(([key, child]) => checkSurveyValues(child, [...path, key], ctx));
  }
  return true;
};

/**
 * The body as the save schemas read it: the dates JSON turned into strings revived (the schemas read them
 * with `z.date()`, and the write compares them as `Date`s), and every value bounded first, before the
 * survey schema spends any work on it. The integer columns are held to Postgres `integer`.
 */
const reviveAndBound = (body: unknown, ctx: z.RefinementCtx): unknown => {
  if (!checkSurveyValues(body, [], ctx)) return body;
  if (isPlainRecord(body)) {
    for (const column of INT_COLUMNS) {
      const value = body[column];
      if (typeof value === "number") {
        checkNumberRange(ctx, value, { min: -SURVEY_SAVE_MAX_INT_COLUMN, max: SURVEY_SAVE_MAX_INT_COLUMN }, [
          column,
        ]);
      }
    }
  }
  return reviveSurveyBodyDates(body);
};

/**
 * `PUT /api/internal/surveys/{surveyId}` body: the whole survey in the editor's own `ZSurvey` shape, as the
 * `updateSurveyAction` it replaces took it. Not made strict: `strictDeep` can't rebuild `ZSurvey` (records,
 * transforms, defaults), and the editor's working copy carries keys the schema doesn't list, which the
 * action always dropped. The public survey PATCH is the strict contract (ENG-7107).
 */
export const ZSurveySaveBody = z.preprocess(reviveAndBound, ZSurvey);

/**
 * `PUT /api/internal/surveys/{surveyId}/draft` body: the editor's draft, as loose as the
 * `updateSurveyDraftAction` it replaces took it (`ZSurveyDraft`): a draft may be incomplete, and is
 * checked in full when it is published.
 */
export const ZSurveyDraftSaveBody = z.preprocess(reviveAndBound, ZSurveyDraft);

export type TSurveySaveBody = z.infer<typeof ZSurveySaveBody>;
export type TSurveyDraftSaveBody = z.infer<typeof ZSurveyDraftSaveBody>;

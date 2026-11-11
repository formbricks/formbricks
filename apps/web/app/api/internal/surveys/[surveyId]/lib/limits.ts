import type { TArrayBudget } from "@/app/api/v3/lib/array-budget";

/**
 * The caps on the survey editor's saves (`PUT /api/internal/surveys/{surveyId}` and its `/draft`),
 * CODING_STANDARDS.md "Input Limits". The body is the whole survey in the editor's own `ZSurvey` shape, and
 * the shared schema bounds few of its fields, so these bound the rest from outside it (ENG-7100 bounds the
 * schema itself). Each is far above any survey the editor builds: a save is the only way out of the editor,
 * so a cap that refused a real survey would strand its work.
 */

/**
 * The largest save body: 5 MiB. Above the survey import's create (`SURVEY_IMPORT_MAX_CREATE_BODY_BYTES`,
 * 3 MiB), so every survey an import can create stays saveable once the editor adds its segment, triggers
 * and languages to it; well below Next's `proxyClientMaxBodySize` (16 MB, `next.config.mjs`). The server
 * actions these routes replace were held to Next's own action limit, so a larger survey could not be
 * saved at all (ENG-6924).
 */
export const SURVEY_SAVE_MAX_BODY_BYTES = 5 * 1024 * 1024;

/**
 * Items one array of the survey may hold: a question's choices, a matrix's rows, a ranking's items.
 * `ZSurvey` caps none of them, and the request-wide default (`V3_REQUEST_ARRAY_MAX_ITEMS`, 1,000) would
 * leave a survey with a longer choice list unsaveable. A country picker has about 250.
 */
export const SURVEY_SAVE_MAX_ARRAY_ITEMS = 10_000;

/**
 * Array elements the whole survey may hold, summed over every array in it. The largest real survey is a
 * few thousand; this leaves room for several of the longest lists above in one survey.
 */
export const SURVEY_SAVE_MAX_TOTAL_ARRAY_ELEMENTS = 100_000;

/** The array limits a save body is held to, in place of the request-wide default. */
export const SURVEY_SAVE_ARRAY_BUDGET: TArrayBudget = {
  maxItems: SURVEY_SAVE_MAX_ARRAY_ITEMS,
  maxTotalElements: SURVEY_SAVE_MAX_TOTAL_ARRAY_ELEMENTS,
};

/**
 * Characters of any one string in the survey: a headline's rich-text HTML, custom head scripts, custom
 * CSS. A whole server-action body used to fit in one. Survey CSS has a far smaller budget of its own
 * (`CUSTOM_CSS_MAX_SOURCE_BYTES`), which the processor still answers with a located error.
 */
export const SURVEY_SAVE_MAX_STRING_LENGTH = 1_000_000;

/**
 * Keys of any one object in the survey. The widest are a translated text, with one key per survey
 * language from a catalog of about 200, and the survey itself, with about 70.
 */
export const SURVEY_SAVE_MAX_OBJECT_KEYS = 1_000;

/**
 * The magnitude of any number in the survey. A JSON body can spell a number no `Date` or column holds
 * (`1e999` parses as `Infinity`); a rating scale, a delay or a validation bound is never near this.
 */
export const SURVEY_SAVE_MAX_NUMBER = Number.MAX_SAFE_INTEGER;

/**
 * The survey's integer columns, each Postgres `integer` (`autoClose`, `autoComplete`, `delay`,
 * `displayLimit`, `recontactDays`): a larger value is refused here rather than failing the write.
 */
export const SURVEY_SAVE_MAX_INT_COLUMN = 2_147_483_647;

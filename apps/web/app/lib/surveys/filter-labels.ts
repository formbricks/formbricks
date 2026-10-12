import { TFunction } from "i18next";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";

/**
 * Display labels for the response filter builder (ENG-645).
 *
 * The English strings stay the stored filter values — `getFormattedFilters` and `META_OP_MAP` in
 * `surveys.ts` match on them to build the response criteria — so they are translated at render
 * time only, never where the options are generated.
 *
 * Each label resolves through a `t("…")` call rather than a bare key string: `scan-translations`
 * (translation-check.yml) reads keys out of the source, and a key it cannot see counts as unused.
 * Where a string already has a key, that key is reused instead of adding a second one for the same
 * English text.
 */
const FILTER_LABELS: Record<string, (t: TFunction) => string> = {
  // Operators
  is: (t) => t("workspace.surveys.summary.response_filters.is"),
  "Includes all": (t) => t("workspace.surveys.summary.includes_all"),
  "Includes either": (t) => t("workspace.surveys.summary.includes_either"),
  "Is equal to": (t) => t("workspace.surveys.summary.is_equal_to"),
  "Is less than": (t) => t("workspace.surveys.summary.is_less_than"),
  "Is more than": (t) => t("workspace.surveys.summary.response_filters.is_more_than"),
  "Is greater than": (t) => t("workspace.surveys.edit.validation.is_greater_than"),
  "Is before": (t) => t("workspace.surveys.edit.is_before"),
  "Is after": (t) => t("workspace.surveys.edit.is_after"),
  "Is set": (t) => t("workspace.surveys.edit.is_set"),
  "Is not set": (t) => t("workspace.surveys.edit.is_not_set"),
  Equals: (t) => t("workspace.surveys.edit.equals"),
  "Not equals": (t) => t("workspace.surveys.summary.response_filters.not_equals"),
  Contains: (t) => t("workspace.surveys.edit.contains"),
  "Does not contain": (t) => t("workspace.surveys.edit.does_not_contain"),
  "Starts with": (t) => t("workspace.surveys.edit.starts_with"),
  "Does not start with": (t) => t("workspace.surveys.edit.does_not_start_with"),
  "Ends with": (t) => t("workspace.surveys.edit.ends_with"),
  "Does not end with": (t) => t("workspace.surveys.edit.does_not_end_with"),
  Status: (t) => t("common.status"),
  // Values. "Submitted" and "Skipped" sit in both menus — one label serves both.
  Submitted: (t) => t("workspace.surveys.summary.response_filters.submitted"),
  Skipped: (t) => t("common.skipped"),
  "Filled out": (t) => t("workspace.surveys.summary.response_filters.filled_out"),
  Clicked: (t) => t("workspace.surveys.summary.response_filters.clicked"),
  Dismissed: (t) => t("common.dismissed"),
  Applied: (t) => t("workspace.surveys.summary.response_filters.applied"),
  "Not applied": (t) => t("workspace.surveys.summary.response_filters.not_applied"),
  Accepted: (t) => t("common.accepted"),
  "Screened in": (t) => t("workspace.surveys.summary.response_filters.screened_in"),
  "Screened out (overquota)": (t) => t("workspace.surveys.summary.response_filters.screened_out"),
  "Not in quota": (t) => t("workspace.surveys.summary.response_filters.not_in_quota"),
};

/**
 * "Other filters" entries. Their English label doubles as the stored filter key — `getFormattedFilters`
 * writes `others[label]`, which the where-clause lowercases into a Prisma field — so it, too, is only
 * swapped for a translation at render time.
 */
const OTHER_FILTER_LABELS: Record<string, (t: TFunction) => string> = {
  Language: (t) => t("common.language"),
};

const PICTURE_OPTION_REGEX = /^Picture (\d+)$/;

/**
 * Matrix is the one filter whose operator menu is user-authored (its rows), so its options are
 * shown verbatim — a row named "Skipped" is the survey author's wording, not ours.
 */
const TYPES_WITH_AUTHORED_OPERATORS: ReadonlySet<string> = new Set([TSurveyElementTypeEnum.Matrix]);

/**
 * Filter types whose value menu we generate ourselves. Everywhere else the values are survey or
 * response data — choice labels, matrix columns, contact attributes, language codes, observed
 * meta values — and must never be run through the label map.
 */
const TYPES_WITH_GENERATED_VALUES: ReadonlySet<string> = new Set([
  TSurveyElementTypeEnum.OpenText,
  TSurveyElementTypeEnum.Rating,
  TSurveyElementTypeEnum.NPS,
  TSurveyElementTypeEnum.CSAT,
  TSurveyElementTypeEnum.CES,
  TSurveyElementTypeEnum.CTA,
  TSurveyElementTypeEnum.Consent,
  TSurveyElementTypeEnum.Address,
  TSurveyElementTypeEnum.ContactInfo,
  TSurveyElementTypeEnum.Ranking,
  TSurveyElementTypeEnum.PictureSelection,
  "Tags",
  "Quotas",
]);

const translateLabel = (value: string, t: TFunction): string => FILTER_LABELS[value]?.(t) ?? value;

/** Label for an operator option ("Includes either", "Is set", …); falls back to the raw value. */
export const getFilterOperatorLabel = (value: string, type: string | undefined, t: TFunction): string => {
  if (type && TYPES_WITH_AUTHORED_OPERATORS.has(type)) return value;
  return translateLabel(value, t);
};

/** Label for a value option ("Filled out", "Picture 2", …); falls back to the raw value. */
export const getFilterValueLabel = (value: string, type: string | undefined, t: TFunction): string => {
  if (!type || !TYPES_WITH_GENERATED_VALUES.has(type)) return value;

  const pictureMatch = PICTURE_OPTION_REGEX.exec(value);
  if (pictureMatch) {
    return t("workspace.surveys.summary.response_filters.picture_index", { index: pictureMatch[1] });
  }

  return translateLabel(value, t);
};

/** Label for an "Other filters" entry (currently Language); falls back to the raw label. */
export const getOtherFilterLabel = (label: string, t: TFunction): string =>
  OTHER_FILTER_LABELS[label]?.(t) ?? label;

import { V3_SURVEY_MAX_HIDDEN_FIELDS, V3_SURVEY_MAX_VARIABLES } from "@/app/api/v3/surveys/schemas";

/**
 * Limits of a Formbricks file's `references` (ADR 0016). Each kind is capped by what one survey can
 * point at, so a file past one was not written by an export.
 */

/** Action classes: one per trigger at most, and the v3 document caps triggers at 50. */
export { V3_SURVEY_MAX_TRIGGERS as FORMBRICKS_FILE_MAX_ACTION_CLASSES } from "@/app/api/v3/surveys/schemas";

/** Contact attribute keys the survey's targeting filters name. */
export const FORMBRICKS_FILE_MAX_ATTRIBUTE_KEYS = 200;

/** Shared embedded-data fields: every hidden field and variable a survey can hold. */
export const FORMBRICKS_FILE_MAX_EMBEDDED_FIELDS = V3_SURVEY_MAX_HIDDEN_FIELDS + V3_SURVEY_MAX_VARIABLES;

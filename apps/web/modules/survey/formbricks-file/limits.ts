import { V3_SURVEY_MAX_HIDDEN_FIELDS, V3_SURVEY_MAX_VARIABLES } from "@/app/api/v3/surveys/schemas";
import { SURVEY_IMPORT_MAX_DRAFT_BYTES } from "@/modules/survey/import/limits";

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

/**
 * How many times reading a file re-parses it after dropping the keys the format does not know. Each pass
 * drops every unknown key the parse reported; a second pass reaches keys inside a dropped key's
 * neighbours that only fail once the outer problem is gone. A file still failing after these is malformed.
 */
export const FORMBRICKS_FILE_MAX_UNKNOWN_KEY_PASSES = 5;

/** Dropped keys the report names one by one; the rest are counted in one more line. */
export const FORMBRICKS_FILE_MAX_REPORTED_DROPPED_KEYS = 50;

/**
 * The most a file's survey may weigh, as JSON: what a draft the import builds may weigh, since the survey
 * becomes that draft and is created with it. A larger one is refused with a 413 before it is checked.
 */
export const FORMBRICKS_FILE_MAX_SURVEY_BYTES = SURVEY_IMPORT_MAX_DRAFT_BYTES;

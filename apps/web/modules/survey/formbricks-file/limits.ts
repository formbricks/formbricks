import { EMBEDDED_DATA_KEY_MAX_LENGTH } from "@formbricks/types/embedded-data";
import { V3_SURVEY_MAX_HIDDEN_FIELDS, V3_SURVEY_MAX_VARIABLES } from "@/app/api/v3/surveys/schemas";
import {
  SURVEY_IMPORT_MAX_DRAFT_BYTES,
  SURVEY_IMPORT_MAX_LANGUAGE_CODE_CHARS,
} from "@/modules/survey/import/limits";

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

/*
 * The strings of a file's envelope and references, each capped, so a file cannot carry an unbounded
 * one into the import's lookups or into the rows it creates. Past one, the file is refused with a 422
 * naming the field. The survey's own strings are capped by the survey document's rules.
 */

/**
 * A key — an action class's, an attribute key's, a shared field's and the storage key the survey links
 * it under: the longest library key a workspace takes (`EMBEDDED_DATA_KEY_MAX_LENGTH`).
 */
export const FORMBRICKS_FILE_MAX_KEY_CHARS = EMBEDDED_DATA_KEY_MAX_LENGTH;

/** A name — an action class's, an attribute key's, a shared field's — and a language's alias. */
export const FORMBRICKS_FILE_MAX_NAME_CHARS = 255;

/** An action class's or an attribute key's description. */
export const FORMBRICKS_FILE_MAX_DESCRIPTION_CHARS = 2_000;

/** A shared field's default value, when it is a text. */
export const FORMBRICKS_FILE_MAX_DEFAULT_VALUE_CHARS = 5_000;

/** A no-code action's configuration as JSON: its URL filters and element selector together. */
export const FORMBRICKS_FILE_MAX_NO_CODE_CONFIG_CHARS = 10_000;

/** A language code, as the import takes one from any file. */
export const FORMBRICKS_FILE_MAX_LANGUAGE_CODE_CHARS = SURVEY_IMPORT_MAX_LANGUAGE_CODE_CHARS;

/** The Formbricks version that wrote the file (`formbricks.appVersion`). */
export const FORMBRICKS_FILE_MAX_APP_VERSION_CHARS = 64;

/** The `$schema` URL a file names. */
export const FORMBRICKS_FILE_MAX_SCHEMA_URL_CHARS = 2_048;

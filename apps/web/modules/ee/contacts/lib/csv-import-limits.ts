/**
 * Limits of a contacts CSV import, the upload dialog's pre-check and `POST /api/internal/contacts/imports`
 * alike. They bound what one import can make the server parse and write, far above a real import: the
 * browser already refuses a file over 800 KB, and the attribute keys a workspace may hold
 * (`MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT`) bound the columns that can actually be stored.
 */

/** Records (rows) in one import. */
export const CSV_IMPORT_MAX_RECORDS = 10_000;

/** Columns (keys) in one record, and entries in the column-to-attribute map. */
export const CSV_IMPORT_MAX_COLUMNS = 160;

/** Longest column name, attribute key or mapped attribute: the cap every attribute key write takes. */
export { ATTRIBUTE_KEY_MAX_LENGTH as CSV_IMPORT_MAX_KEY_LENGTH } from "@/app/api/internal/contact-attribute-keys/schemas";

/** Longest cell value. */
export const CSV_IMPORT_MAX_VALUE_LENGTH = 10_000;

/** The request body: the 2 MB server actions took before the import moved to its route. */
export const CSV_IMPORT_MAX_BODY_BYTES = 2 * 1024 * 1024;

/**
 * The array budget the import route is held to before its schema runs. The records are the body's only
 * array, and their cells are object entries, not array elements, so both limits are the record cap;
 * the column, key and value caps and `CSV_IMPORT_MAX_BODY_BYTES` bound the rest.
 */
export const CSV_IMPORT_ARRAY_BUDGET = {
  maxItems: CSV_IMPORT_MAX_RECORDS,
  maxTotalElements: CSV_IMPORT_MAX_RECORDS,
} as const;

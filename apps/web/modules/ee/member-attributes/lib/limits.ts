/**
 * Input limits for Member attributes (ENG-7468, CODING_STANDARDS "Input Limits"). Every write path —
 * the v3 key routes, the bulk values route, Member settings (through the bulk route), the CSV import
 * (through the bulk route) and invite acceptance — reads them from here.
 *
 * They are far above real use: an organization describes its members with a handful of keys (Country,
 * Region, Team), a member holds a few values per key, and the CSV import is built for a few hundred rows.
 */

/** Attribute keys one organization may define, the built-in Email not counted. */
export const MEMBER_ATTRIBUTE_MAX_KEYS_PER_ORGANIZATION = 50;

/** Values one member (or one invite) may hold for one key. */
export const MEMBER_ATTRIBUTE_MAX_VALUES_PER_KEY = 50;

/** Characters in one value, after trimming. */
export const MEMBER_ATTRIBUTE_MAX_VALUE_LENGTH = 255;

/** Characters in a key's label and description, and in the key itself. */
export const MEMBER_ATTRIBUTE_MAX_LABEL_LENGTH = 100;
export const MEMBER_ATTRIBUTE_MAX_DESCRIPTION_LENGTH = 500;
export const MEMBER_ATTRIBUTE_MAX_KEY_LENGTH = 64;

/**
 * A key: lowercase letters, numbers and underscores, starting with a letter, so it reads the same in a
 * CSV header, a Dashboard Viewer access condition and an API body.
 */
export const MEMBER_ATTRIBUTE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

/**
 * Keys no organization may define: `email` is the built-in Email attribute (read from the login email,
 * never stored), and the others are the CSV import's own member columns.
 */
export const MEMBER_ATTRIBUTE_RESERVED_KEYS: ReadonlySet<string> = new Set([
  "email",
  "name",
  "full_name",
  "role",
  "teams",
]);

/** Rows in one bulk values request. A 200-row CSV import is one request. */
export const MEMBER_ATTRIBUTE_MAX_BULK_ROWS = 500;

/** Keys one bulk row may set: every key the organization can have. */
export const MEMBER_ATTRIBUTE_MAX_KEYS_PER_ROW = MEMBER_ATTRIBUTE_MAX_KEYS_PER_ORGANIZATION;

/** Characters in an email a bulk row matches on (RFC 5321's path limit). */
export const MEMBER_ATTRIBUTE_MAX_EMAIL_LENGTH = 320;

/** Page size of the members' values list: default and cap. */
export const MEMBER_ATTRIBUTE_LIST_DEFAULT_LIMIT = 50;
export const MEMBER_ATTRIBUTE_LIST_MAX_LIMIT = 250;

/** Characters in the members' values list search. */
export const MEMBER_ATTRIBUTE_MAX_SEARCH_LENGTH = 255;

/** Datasets a 409 for a key in use names; the count says how many there are in all. */
export const MEMBER_ATTRIBUTE_MAX_DATASETS_IN_CONFLICT = 20;

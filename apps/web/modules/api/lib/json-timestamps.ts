/**
 * Internal API routes send a record's `createdAt` and `updatedAt` as ISO strings. These give the client the
 * wire type and turn the strings back into `Date`s, so a component keeps the types the page rendered with.
 */

/** `T` as an internal route sends it: `createdAt` and `updatedAt` as ISO strings. */
export type TJsonTimestamps<T> = Omit<T, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

/** `value` with its `createdAt` and `updatedAt` back as `Date`s. */
export const reviveTimestamps = <T extends { createdAt: string; updatedAt: string }>(value: T) => ({
  ...value,
  createdAt: new Date(value.createdAt),
  updatedAt: new Date(value.updatedAt),
});

/** `T` as an internal route sends it when only `updatedAt` is a date: as an ISO string. */
export type TJsonUpdatedAt<T> = Omit<T, "updatedAt"> & { updatedAt: string };

/** `value` with its `updatedAt` back as a `Date`. */
export const reviveUpdatedAt = <T extends { updatedAt: string }>(value: T) => ({
  ...value,
  updatedAt: new Date(value.updatedAt),
});

/**
 * Where the dates sit in a nested JSON value, for `reviveDates`: `true` marks a date, an object names the
 * keys to look under, and a one-element array applies its shape to every element of an array. A survey's
 * dates, for one, sit on the survey itself and inside its languages, triggers, segment and follow-ups.
 */
export type TJsonDateShape = true | readonly [TJsonDateShape] | { readonly [key: string]: TJsonDateShape };

/** An ISO 8601 date-time with a `Z` or an offset: what `JSON.stringify` makes of a `Date`. */
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isArrayShape = (shape: TJsonDateShape): shape is readonly [TJsonDateShape] => Array.isArray(shape);

/** An ISO date-time string as a `Date`. Anything else is left as it is, for a schema to judge. */
const reviveDate = (value: unknown): unknown => {
  if (typeof value !== "string" || !ISO_DATE_TIME.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date;
};

/**
 * `value` with the ISO strings `shape` points at turned back into `Date`s, at any depth: what JSON loses of
 * a value that carried dates. Only those places are touched, so a string elsewhere that happens to look like
 * a date stays a string. A key that is missing, or holds something of another shape, is left as it is, so
 * the server can run it on a request body before its schema answers for it. Copies what it changes and
 * never mutates `value`.
 */
export const reviveDates = (value: unknown, shape: TJsonDateShape): unknown => {
  if (shape === true) return reviveDate(value);
  if (isArrayShape(shape)) {
    return Array.isArray(value) ? value.map((item) => reviveDates(item, shape[0])) : value;
  }
  if (!isRecord(value)) return value;

  const revived: Record<string, unknown> = { ...value };
  for (const [key, child] of Object.entries(shape)) {
    if (Object.hasOwn(value, key)) revived[key] = reviveDates(value[key], child);
  }
  return revived;
};

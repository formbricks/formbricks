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

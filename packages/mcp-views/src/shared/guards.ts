/** A plain object (not an array, not null), for narrowing parsed JSON. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

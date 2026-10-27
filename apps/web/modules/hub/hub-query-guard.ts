/**
 * Refuses filter values the SDK would serialize into something other than what the caller meant.
 *
 * `@formbricks/hub` (0.14+) serializes query params itself, and is lenient where a filter must not be:
 * it omits an empty array and a `null`, and sends a nested object (a `Date` included) as deepObject
 * brackets. Each of those silently drops or mangles the filter, and a dropped filter *widens* the result
 * set with no signal to the caller — the failure `FILTER_KEY_KIND` in the v3 operations exists to prevent.
 * The v3 schemas bound every array filter with `.min(1)`, so this is a tripwire rather than a reachable
 * path; it keeps the guarantee the hand-written serializer the SDK replaced used to give.
 *
 * Deliberately free of `server-only`, `env` and any SDK import, so it can be unit-tested on its own.
 */

/** Thrown for a query value with no faithful wire form. */
export class HubQueryValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HubQueryValueError";
  }
}

const isScalar = (value: unknown): value is string | number | boolean =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

const describe = (value: unknown): string => (value === null ? "null" : `a ${typeof value}`);

/**
 * Throws `HubQueryValueError` naming the first parameter that would not reach the Hub as given.
 *
 * `undefined` means "absent" and is skipped. An empty string is a real value (the no-source bucket for
 * `source_id`) and passes.
 */
export const assertSerializableHubQuery = (query: object): void => {
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      if (value.length === 0) {
        throw new HubQueryValueError(
          `Query parameter "${key}" is an empty array, which would silently drop the filter instead of narrowing it.`
        );
      }
      const invalidIndex = value.findIndex((element) => !isScalar(element));
      if (invalidIndex !== -1) {
        throw new HubQueryValueError(
          `Query parameter "${key}" holds ${describe(value[invalidIndex])}; pass primitives or an array of primitives.`
        );
      }
      continue;
    }

    if (!isScalar(value)) {
      throw new HubQueryValueError(
        `Query parameter "${key}" is ${describe(value)}; pass primitives or an array of primitives.`
      );
    }
  }
};

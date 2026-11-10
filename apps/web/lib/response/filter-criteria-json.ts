import { z } from "zod";
import { ZResponseFilterCriteria } from "@formbricks/types/responses";

/**
 * The response filter as it crosses the wire. Pure, with no server-only imports, so the routes that take a
 * filter in their body and the client code that builds one can share it.
 */

/**
 * The filter crosses the wire as JSON, where `createdAt`'s Dates are ISO text. Turn them back into Dates
 * before the shared filter schema, which (like the server actions the routes replace) expects `Date`.
 */
export const reviveFilterDates = (filter: unknown): unknown => {
  if (typeof filter !== "object" || filter === null || !("createdAt" in filter)) return filter;
  const { createdAt } = filter as { createdAt: unknown };
  if (typeof createdAt !== "object" || createdAt === null) return filter;
  const revive = (value: unknown) => (typeof value === "string" ? new Date(value) : value);
  const { min, max } = createdAt as { min?: unknown; max?: unknown };
  return {
    ...filter,
    createdAt: {
      ...(min === undefined ? {} : { min: revive(min) }),
      ...(max === undefined ? {} : { max: revive(max) }),
    },
  };
};

/**
 * A response filter read from a JSON body: the shared `ZResponseFilterCriteria` with its rules and caps
 * (the per-field condition and value counts), after its `createdAt` window is revived.
 *
 * The shared schema strips unknown keys rather than refusing them, and `strictDeep` cannot make it strict:
 * its per-question conditions are records. The body around it is strict; inside the filter an unknown key
 * is dropped, as the server actions these routes replace dropped it.
 */
export const ZResponseFilterCriteriaJson = z.preprocess(reviveFilterDates, ZResponseFilterCriteria);

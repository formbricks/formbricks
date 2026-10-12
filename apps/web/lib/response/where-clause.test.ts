import { describe, expect, test } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { type TResponseFilterCriteria } from "@formbricks/types/responses";
import { type TSurvey } from "@formbricks/types/surveys/types";
import { buildWhereClause } from "./where-clause";

/**
 * The range condition a date-only filter value produces (ENG-3232) → Prisma. The rest of
 * `buildWhereClause` is exercised through the service and the integration suites; what is pinned
 * here is the one translation whose shape carries the semantics: a half-open `[min, max)` window,
 * and a complement that an absent value falls into.
 */

const embeddedField = (storageKey: string, source: string, dataType: string) => ({
  field: { name: storageKey, source, dataType, defaultValue: null, locked: false },
  link: { storageKey },
});

const survey = {
  id: "survey1",
  blocks: [],
  embeddedFields: [
    // The two groups live in different columns: `processIngestedFilters` writes ingested storage
    // keys into `data`, `processVariableFilters` writes computed ones into `variables`.
    embeddedField("signup_date", "ingested", "date"),
    embeddedField("coupon", "ingested", "string"),
    embeddedField("renewal_date", "computed", "date"),
    embeddedField("plan", "computed", "string"),
    embeddedField("visits", "ingested", "number"),
    embeddedField("score", "computed", "number"),
  ],
} as unknown as TSurvey;

/** The `AND` clause `buildWhereClause` pushes for one criteria group, unwrapped. */
const clausesFor = (filterCriteria: TResponseFilterCriteria) =>
  buildWhereClause(survey, filterCriteria).AND.flatMap((clause) =>
    clause && typeof clause === "object" && "AND" in clause ? (clause.AND ?? []) : []
  );

describe("buildWhereClause: date windows", () => {
  const window = { min: "2026-09-01", max: "2026-09-02" } as const;

  test("an ingested field's window becomes gte/lt on the data column", () => {
    expect(clausesFor({ data: { signup_date: { op: "inRange", ...window } } })).toEqual([
      {
        AND: [
          { data: { path: ["signup_date"], gte: window.min } },
          { data: { path: ["signup_date"], lt: window.max } },
        ],
      },
    ]);
  });

  test("the complement matches either side of the window, and an absent value", () => {
    expect(clausesFor({ data: { signup_date: { op: "notInRange", ...window } } })).toEqual([
      {
        OR: [
          { data: { path: ["signup_date"], lt: window.min } },
          { data: { path: ["signup_date"], gte: window.max } },
          { data: { path: ["signup_date"], equals: Prisma.DbNull } },
        ],
      },
    ]);
  });

  test("a computed field's window filters the variables column the same way", () => {
    expect(clausesFor({ variables: { renewal_date: { op: "inRange", ...window } } })).toEqual([
      {
        AND: [
          { variables: { path: ["renewal_date"], gte: window.min } },
          { variables: { path: ["renewal_date"], lt: window.max } },
        ],
      },
    ]);
  });

  test("the complement on the variables column matches either side, and an absent value", () => {
    // The data column's complement is pinned above; this is the other translator, and it is a
    // separate code path rather than the same one parameterised — so an inverted bound or a dropped
    // absent-value arm here would not show up there.
    expect(clausesFor({ variables: { renewal_date: { op: "notInRange", ...window } } })).toEqual([
      {
        OR: [
          { variables: { path: ["renewal_date"], lt: window.min } },
          { variables: { path: ["renewal_date"], gte: window.max } },
          { variables: { path: ["renewal_date"], equals: Prisma.DbNull } },
        ],
      },
    ]);
  });

  test("fails closed: a window on a string-typed field emits nothing, in either column", () => {
    // Nothing offers a range for a string field, so one could only have been crafted — and `lt` on
    // a string column would silently answer with a lexicographic slice of it.
    expect(clausesFor({ variables: { plan: { op: "inRange", ...window } } })).toEqual([]);
    expect(clausesFor({ variables: { plan: { op: "notInRange", ...window } } })).toEqual([]);
    expect(clausesFor({ data: { coupon: { op: "inRange", ...window } } })).toEqual([]);
    expect(clausesFor({ data: { coupon: { op: "notInRange", ...window } } })).toEqual([]);
  });

  test("fails closed: a window on a number-typed field emits nothing, in either column", () => {
    // The bounds are strings, so `gte`/`lt` against a stored number would compare across JSON types
    // rather than by value — "10" sorts before "9". Numbers filter through the numeric comparison
    // operators instead, which is all `buildTypedFieldCondition` ever gives a `number` field.
    expect(clausesFor({ data: { visits: { op: "inRange", ...window } } })).toEqual([]);
    expect(clausesFor({ data: { visits: { op: "notInRange", ...window } } })).toEqual([]);
    expect(clausesFor({ variables: { score: { op: "inRange", ...window } } })).toEqual([]);
    expect(clausesFor({ variables: { score: { op: "notInRange", ...window } } })).toEqual([]);
  });

  test("fails closed: a window on a key no ingested field answers for emits nothing", () => {
    // `data` is shared with element ids, so it cannot drop unrecognised keys the way `variables`
    // does — but a range is still only ever produced for an ingested field.
    expect(clausesFor({ data: { q1: { op: "inRange", ...window } } })).toEqual([]);
    expect(clausesFor({ data: { renewal_date: { op: "inRange", ...window } } })).toEqual([]);
  });
});

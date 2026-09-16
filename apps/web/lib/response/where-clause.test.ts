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
    embeddedField("signup_date", "computed", "date"),
    embeddedField("plan", "computed", "string"),
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
    expect(clausesFor({ variables: { signup_date: { op: "inRange", ...window } } })).toEqual([
      {
        AND: [
          { variables: { path: ["signup_date"], gte: window.min } },
          { variables: { path: ["signup_date"], lt: window.max } },
        ],
      },
    ]);
  });

  test("fails closed: a window on a string-typed field emits nothing", () => {
    // Nothing offers a range for a string field, so one could only have been crafted — and `lt` on
    // a string column would silently answer with a lexicographic slice of it.
    expect(clausesFor({ variables: { plan: { op: "inRange", ...window } } })).toEqual([]);
    expect(clausesFor({ variables: { plan: { op: "notInRange", ...window } } })).toEqual([]);
  });
});

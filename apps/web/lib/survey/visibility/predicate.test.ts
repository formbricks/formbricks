import { describe, expect, test } from "vitest";
import type { TSurveyActorContext } from "./actor-context";
import { getEffectiveVisibility } from "./policy";
import {
  andVisibleSurveys,
  buildHiddenSurveyWhere,
  buildVisibleResponseWhere,
  buildVisibleSurveyWhere,
  buildVisibleSurveyWhereAcrossOrganizations,
  visibleSurveySqlPredicate,
} from "./predicate";

const member: TSurveyActorContext = {
  enforced: true,
  isOrganizationAdmin: false,
  kind: "user",
  userId: "u-1",
};
const admin: TSurveyActorContext = { enforced: true, isOrganizationAdmin: true, kind: "user", userId: "u-2" };
const apiKey: TSurveyActorContext = { enforced: true, kind: "apiKey" };

const sqlOf = (ctx: TSurveyActorContext) => {
  const fragment = visibleSurveySqlPredicate(ctx, "s");
  return { text: fragment.sql, values: fragment.values };
};

describe("buildVisibleSurveyWhere", () => {
  test.each([
    ["an unenforced member", { ...member, enforced: false }],
    ["an unenforced API key", { ...apiKey, enforced: false }],
    ["an organization administrator", admin],
  ] as const)("restricts nothing for %s", (_label, ctx) => {
    expect(buildVisibleSurveyWhere(ctx)).toEqual({});
    expect(buildVisibleResponseWhere(ctx)).toEqual({});
    expect(sqlOf(ctx)).toEqual({ text: "TRUE", values: [] });
  });

  test("a member sees settled workspace-visible surveys and their own, pending or not", () => {
    expect(buildVisibleSurveyWhere(member)).toEqual({
      OR: [
        {
          visibility: "workspace",
          OR: [{ visibilityPending: false }, { visibilityVersion: 0, visibilityProjectedVersion: { lt: 0 } }],
        },
        { ownerId: "u-1" },
      ],
    });
    expect(buildVisibleResponseWhere(member)).toEqual({
      survey: {
        OR: [
          {
            visibility: "workspace",
            OR: [
              { visibilityPending: false },
              { visibilityVersion: 0, visibilityProjectedVersion: { lt: 0 } },
            ],
          },
          { ownerId: "u-1" },
        ],
      },
    });
    expect(sqlOf(member)).toEqual({
      text: '(("s"."visibility" = \'workspace\' AND ("s"."visibilityPending" = false OR ("s"."visibilityVersion" = 0 AND "s"."visibilityProjectedVersion" < 0))) OR "s"."ownerId" = ?)',
      values: ["u-1"],
    });
  });

  test("an API key sees settled workspace-visible surveys only — never a restricted or pending one", () => {
    expect(buildVisibleSurveyWhere(apiKey)).toEqual({
      visibility: "workspace",
      OR: [{ visibilityPending: false }, { visibilityVersion: 0, visibilityProjectedVersion: { lt: 0 } }],
    });
    expect(sqlOf(apiKey)).toEqual({
      text: '("s"."visibility" = \'workspace\' AND ("s"."visibilityPending" = false OR ("s"."visibilityVersion" = 0 AND "s"."visibilityProjectedVersion" < 0)))',
      values: [],
    });
  });

  test("refuses an alias that is not a bare identifier", () => {
    expect(() => visibleSurveySqlPredicate(member, 's"; DROP TABLE "Survey')).toThrow("Invalid SQL alias");
  });
});

describe("buildVisibleSurveyWhereAcrossOrganizations", () => {
  test("restricts nothing while enforcement is off", () => {
    expect(buildVisibleSurveyWhereAcrossOrganizations(false, "u1")).toEqual({});
  });

  test("admits shared surveys, owned ones, and every survey of an organization the user administers", () => {
    expect(buildVisibleSurveyWhereAcrossOrganizations(true, "u1")).toEqual({
      OR: [
        {
          visibility: "workspace",
          OR: [{ visibilityPending: false }, { visibilityVersion: 0, visibilityProjectedVersion: { lt: 0 } }],
        },
        { ownerId: "u1" },
        {
          workspace: {
            organization: { memberships: { some: { userId: "u1", role: { in: ["owner", "manager"] } } } },
          },
        },
      ],
    });
  });
});

describe("andVisibleSurveys", () => {
  test("is empty while nothing is restricted, so unenforced queries are unchanged", () => {
    expect(andVisibleSurveys({})).toEqual({});
  });

  test("nests the clause under AND, so it cannot replace the caller's tenant scope", () => {
    const clause = { workspaceId: "other", visibility: "workspace" as const };
    expect({ workspaceId: "mine", ...andVisibleSurveys(clause) }).toEqual({
      workspaceId: "mine",
      AND: [clause],
    });
  });
});

describe("buildHiddenSurveyWhere", () => {
  type TRow = Readonly<{
    ownerId: string | null;
    visibility: "workspace" | "restricted";
    visibilityPending: boolean;
    visibilityProjectedVersion: number;
    visibilityVersion: number;
  }>;

  /** Evaluates the clause shapes the predicate emits, with SQL's null semantics for `not`. */
  const matches = (where: Record<string, unknown>, row: TRow): boolean =>
    Object.entries(where).every(([key, condition]) => {
      if (key === "AND") return (condition as Record<string, unknown>[]).every((c) => matches(c, row));
      if (key === "OR") return (condition as Record<string, unknown>[]).some((c) => matches(c, row));
      if (key === "NOT") return !matches(condition as Record<string, unknown>, row);
      const value = row[key as keyof TRow];
      if (condition !== null && typeof condition === "object") {
        const operator = condition as { lt?: number; not?: unknown };
        if ("lt" in operator) return typeof value === "number" && value < (operator.lt ?? 0);
        if ("not" in operator) return value !== null && value !== operator.not;
      }
      return value === condition;
    });

  const rows: TRow[] = [];
  for (const visibility of ["workspace", "restricted"] as const) {
    for (const ownerId of [null, "u-1", "u-other"]) {
      for (const [visibilityVersion, visibilityProjectedVersion] of [
        [0, 0],
        [0, -1],
        [1, 0],
        [2, 2],
      ]) {
        rows.push({
          ownerId,
          visibility,
          visibilityPending: visibilityVersion !== visibilityProjectedVersion,
          visibilityProjectedVersion,
          visibilityVersion,
        });
      }
    }
  }

  test.each([
    ["an unenforced member", { ...member, enforced: false }],
    ["an unenforced API key", { ...apiKey, enforced: false }],
    ["an organization administrator", admin],
  ] as const)("hides nothing for %s", (_label, ctx) => {
    expect(buildHiddenSurveyWhere(ctx)).toBeNull();
  });

  // The point of the helper: exactly the rows the visible predicate drops, an ownerless restricted
  // survey included, where `NOT visible` would evaluate to null and keep it.
  test.each([
    ["a member", member],
    ["an API key", apiKey],
  ] as const)("is the exact complement of the visible predicate for %s", (_label, ctx) => {
    const hidden = buildHiddenSurveyWhere(ctx);
    expect(hidden).not.toBeNull();

    for (const row of rows) {
      const visible =
        getEffectiveVisibility(row) === "workspace" || (ctx.kind === "user" && row.ownerId === ctx.userId);
      expect(matches(hidden ?? {}, row)).toBe(!visible);
      expect(matches(buildVisibleSurveyWhere(ctx), row)).toBe(visible);
    }
  });
});

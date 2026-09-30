import { describe, expect, test } from "vitest";
import type { TSurveyActorContext } from "./actor-context";
import {
  andVisibleSurveys,
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

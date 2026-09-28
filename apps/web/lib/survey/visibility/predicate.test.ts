import { describe, expect, test } from "vitest";
import type { TSurveyActorContext } from "./actor-context";
import { buildVisibleResponseWhere, buildVisibleSurveyWhere, visibleSurveySqlPredicate } from "./predicate";

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
      OR: [{ visibility: "workspace", visibilityPending: false }, { ownerId: "u-1" }],
    });
    expect(buildVisibleResponseWhere(member)).toEqual({
      survey: { OR: [{ visibility: "workspace", visibilityPending: false }, { ownerId: "u-1" }] },
    });
    expect(sqlOf(member)).toEqual({
      text: '(("s"."visibility" = \'workspace\' AND "s"."visibilityPending" = false) OR "s"."ownerId" = ?)',
      values: ["u-1"],
    });
  });

  test("an API key sees settled workspace-visible surveys only — never a private or pending one", () => {
    expect(buildVisibleSurveyWhere(apiKey)).toEqual({ visibility: "workspace", visibilityPending: false });
    expect(sqlOf(apiKey)).toEqual({
      text: '("s"."visibility" = \'workspace\' AND "s"."visibilityPending" = false)',
      values: [],
    });
  });

  test("refuses an alias that is not a bare identifier", () => {
    expect(() => visibleSurveySqlPredicate(member, 's"; DROP TABLE "Survey')).toThrow("Invalid SQL alias");
  });
});

import { describe, expect, test } from "vitest";
import { deriveSurveyAccess, getReportedVisibility, serializeSurveyOwner } from "./access";
import type { TSurveyActorContext } from "./actor-context";

const owner: TSurveyActorContext = {
  enforced: true,
  isOrganizationAdmin: false,
  kind: "user",
  userId: "owner",
};
const admin: TSurveyActorContext = {
  enforced: true,
  isOrganizationAdmin: true,
  kind: "user",
  userId: "admin",
};
const adminOwner: TSurveyActorContext = { ...admin, userId: "owner" };
const member: TSurveyActorContext = {
  enforced: true,
  isOrganizationAdmin: false,
  kind: "user",
  userId: "member",
};
const apiKey: TSurveyActorContext = { enforced: true, kind: "apiKey" };

const on = { entitled: true, ready: true } as const;
const unentitled = { entitled: false, ready: true } as const;
const off = { entitled: false, ready: false } as const;

const row = (visibility: "private" | "workspace", pending = false) => ({
  ownerId: "owner",
  visibility,
  visibilityProjectedVersion: 1,
  visibilityVersion: pending ? 2 : 1,
});

describe("deriveSurveyAccess", () => {
  test.each([
    ["owner, private", row("private"), owner, on, { canManageVisibility: true, via: "owner" }],
    ["admin, private", row("private"), admin, on, { canManageVisibility: true, via: "organizationRole" }],
    // Lowest privilege first: an administrator who owns the survey sees `owner`.
    ["admin owner, private", row("private"), adminOwner, on, { canManageVisibility: true, via: "owner" }],
    ["admin, workspace", row("workspace"), admin, on, { canManageVisibility: true, via: "workspace" }],
    ["member, workspace", row("workspace"), member, on, { canManageVisibility: false, via: "workspace" }],
    ["owner, workspace", row("workspace"), owner, on, { canManageVisibility: true, via: "workspace" }],
    // A pending grant is still private on this request.
    ["owner, pending grant", row("workspace", true), owner, on, { canManageVisibility: true, via: "owner" }],
    ["api key", row("workspace"), apiKey, on, { canManageVisibility: false, via: "workspace" }],
    // Entitlement off keeps private surveys hidden but takes the controls away (README §5 row 2).
    ["owner, unentitled", row("private"), owner, unentitled, { canManageVisibility: false, via: "owner" }],
    // Marker off: everything reads as workspace-visible, no controls (README §5 row 3).
    ["owner, marker off", row("private"), owner, off, { canManageVisibility: false, via: "workspace" }],
  ] as const)("%s", (_label, survey, ctx, gates, expected) => {
    expect(deriveSurveyAccess(survey, ctx, gates)).toEqual(expected);
  });
});

describe("getReportedVisibility", () => {
  test("reports the enforced value: pending counts as private, marker off reads as workspace", () => {
    expect(getReportedVisibility(row("private"), on)).toBe("private");
    expect(getReportedVisibility(row("workspace", true), on)).toBe("private");
    expect(getReportedVisibility(row("workspace"), on)).toBe("workspace");
    expect(getReportedVisibility(row("private"), off)).toBe("workspace");
  });
});

describe("serializeSurveyOwner", () => {
  test("exposes a name only", () => {
    expect(serializeSurveyOwner("Ada")).toEqual({ name: "Ada" });
    expect(serializeSurveyOwner(null)).toBeNull();
    expect(serializeSurveyOwner(undefined)).toBeNull();
  });
});

import { describe, expect, test } from "vitest";
import type { TMember } from "@formbricks/types/memberships";
import type { TInvite } from "@/modules/organization/settings/teams/types/invites";
import {
  buildMemberTableRows,
  getAttributeSuggestions,
  getChangedAttributes,
  matchesMemberSearch,
} from "./member-table";

const member = (overrides: Partial<TMember> = {}): TMember => ({
  name: "Anna",
  email: "Anna@example.com",
  userId: "user_anna",
  accepted: true,
  role: "member",
  isActive: true,
  ...overrides,
});

const invite = (overrides: Partial<TInvite> = {}) =>
  ({
    id: "inv_1",
    email: "ben@example.com",
    name: "Ben",
    role: "dashboard_viewer",
    createdAt: new Date("2026-11-01"),
    expiresAt: new Date("2026-12-01"),
    ...overrides,
  }) as unknown as TInvite;

const team = { id: "team_1", name: "Sales", workspaceAccess: [] };

describe("buildMemberTableRows", () => {
  test("joins members and invites to their teams and values by email, ignoring case", () => {
    const rows = buildMemberTableRows({
      members: [member(), member({ userId: "user_c", email: "c@example.com", isActive: false })],
      invites: [
        invite(),
        invite({ id: "inv_2", email: "old@example.com", expiresAt: new Date("2026-01-01") }),
      ],
      teamsByUserId: { user_anna: [{ ...team, role: "admin" }] },
      teamsByInviteId: { inv_1: [team] },
      attributeRows: [
        { type: "member", email: "anna@example.com", attributes: { country: ["Sweden"] } },
        { type: "invite", email: "BEN@example.com", attributes: { country: ["Norway"] } },
        // A member and an invite to one address are told apart by type.
        { type: "invite", email: "anna@example.com", attributes: { country: ["Wrong"] } },
      ],
      now: new Date("2026-11-23"),
    });

    expect(rows.map((row) => [row.id, row.status])).toEqual([
      ["member:user_anna", "active"],
      ["member:user_c", "inactive"],
      ["invite:inv_1", "invited"],
      ["invite:inv_2", "expired"],
    ]);
    expect(rows[0].attributes).toEqual({ country: ["Sweden"] });
    expect(rows[0].teams[0].role).toBe("admin");
    expect(rows[2].attributes).toEqual({ country: ["Norway"] });
    expect(rows[2].teams.map((t) => t.name)).toEqual(["Sales"]);
  });
});

describe("matchesMemberSearch", () => {
  test("matches name or email ignoring case", () => {
    const [row] = buildMemberTableRows({
      members: [member()],
      invites: [],
      teamsByUserId: {},
      teamsByInviteId: {},
      attributeRows: [],
    });
    expect(matchesMemberSearch(row, "ann")).toBe(true);
    expect(matchesMemberSearch(row, "EXAMPLE")).toBe(true);
    expect(matchesMemberSearch(row, "zed")).toBe(false);
    expect(matchesMemberSearch(row, " ")).toBe(true);
  });
});

describe("getAttributeSuggestions", () => {
  test("lists each value once, ignoring case, alphabetically", () => {
    const rows = buildMemberTableRows({
      members: [member(), member({ userId: "u2", email: "b@example.com" })],
      invites: [],
      teamsByUserId: {},
      teamsByInviteId: {},
      attributeRows: [
        { type: "member", email: "anna@example.com", attributes: { country: ["Sweden", "Norway"] } },
        { type: "member", email: "b@example.com", attributes: { country: ["sweden", "Denmark"] } },
      ],
    });
    expect(getAttributeSuggestions(rows, "country")).toEqual(["Denmark", "Norway", "Sweden"]);
    expect(getAttributeSuggestions(rows, "city")).toEqual([]);
  });
});

describe("getChangedAttributes", () => {
  test("returns only keys whose values changed, cleared keys included", () => {
    expect(
      getChangedAttributes(
        { country: ["Sweden"], city: ["Malmö"], team: ["A"] },
        { country: ["Sweden"], city: [], team: ["A", "B"], region: [] }
      )
    ).toEqual({ city: [], team: ["A", "B"] });
  });
});

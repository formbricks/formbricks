import { describe, expect, test } from "vitest";
import {
  type TInviteInput,
  type TMemberRow,
  type TMembershipInput,
  buildMemberRows,
  getAssignableRoles,
  getMemberRowAccess,
  hasMoreThanOneActiveOwner,
} from "./member-rows";

const NOW = new Date("2026-06-10T12:00:00Z");

const membership = (
  userId: string,
  role: TMembershipInput["role"],
  user: Partial<TMembershipInput["user"]> = {}
): TMembershipInput => ({
  userId,
  role,
  user: {
    name: userId,
    email: `${userId}@acme.com`,
    isActive: true,
    twoFactorEnabled: false,
    teamUsers: [],
    ...user,
  },
});

const invite = (id: string, overrides: Partial<TInviteInput> = {}): TInviteInput => ({
  id,
  email: `${id}@acme.com`,
  name: null,
  role: "member",
  createdAt: new Date("2026-06-08T12:00:00Z"),
  expiresAt: new Date("2026-06-15T12:00:00Z"),
  teamIds: [],
  ...overrides,
});

const rowsFor = (memberships: TMembershipInput[], invites: TInviteInput[] = []) =>
  buildMemberRows({
    memberships,
    invites,
    teamNameById: new Map([
      ["t1", "Product"],
      ["t2", "Growth"],
    ]),
    now: NOW,
  });

const byId = (rows: TMemberRow[], id: string) => {
  const row = rows.find((candidate) => candidate.id === id);
  if (!row) throw new Error(`no row ${id}`);
  return row;
};

describe("buildMemberRows", () => {
  test("lists members by role then name, with pending invites after them", () => {
    const rows = rowsFor(
      [
        membership("zoe", "member"),
        membership("amy", "member"),
        membership("olga", "owner"),
        membership("max", "manager"),
      ],
      [invite("leo")]
    );

    expect(rows.map((row) => row.id)).toEqual(["olga", "max", "amy", "zoe", "leo"]);
    expect(rows.at(-1)).toMatchObject({ kind: "invite", status: "pending", twoFactorEnabled: null });
  });

  test("carries two-factor state, status and sorted team names of a member", () => {
    const rows = rowsFor([
      membership("amy", "member", {
        twoFactorEnabled: true,
        isActive: false,
        teamUsers: [{ team: { name: "Product" } }, { team: { name: "Growth" } }],
      }),
    ]);

    expect(rows[0]).toMatchObject({
      twoFactorEnabled: true,
      status: "inactive",
      teamNames: ["Growth", "Product"],
    });
  });

  test("marks an invite expired once its time has passed and resolves team ids to names", () => {
    const rows = rowsFor(
      [],
      [
        invite("late", { expiresAt: new Date("2026-06-09T12:00:00Z") }),
        invite("teamed", { teamIds: ["t2", "gone", "t1"] }),
      ]
    );

    expect(byId(rows, "late").status).toBe("expired");
    expect(byId(rows, "teamed").teamNames).toEqual(["Growth", "Product"]);
  });
});

describe("hasMoreThanOneActiveOwner", () => {
  test("ignores deactivated owners and owner invites", () => {
    const rows = rowsFor(
      [membership("a", "owner"), membership("b", "owner", { isActive: false })],
      [invite("c", { role: "owner" })]
    );

    expect(hasMoreThanOneActiveOwner(rows)).toBe(false);
    expect(hasMoreThanOneActiveOwner(rowsFor([membership("a", "owner"), membership("b", "owner")]))).toBe(
      true
    );
  });
});

describe("getAssignableRoles", () => {
  test("owners hand out every role, billing on Cloud only; managers only member", () => {
    expect(getAssignableRoles({ currentRole: "owner", isFormbricksCloud: false })).toEqual([
      "member",
      "manager",
      "owner",
    ]);
    expect(getAssignableRoles({ currentRole: "owner", isFormbricksCloud: true })).toContain("billing");
    expect(getAssignableRoles({ currentRole: "manager", isFormbricksCloud: true })).toEqual(["member"]);
    expect(getAssignableRoles({ currentRole: "member", isFormbricksCloud: true })).toEqual([]);
  });
});

describe("getMemberRowAccess", () => {
  const base = {
    currentUserId: "me",
    currentRole: "owner" as const,
    canManageUsers: true,
    canEditRoles: true,
    isFormbricksCloud: false,
    isMultiOrgEnabled: true,
    hasOtherOrganizations: true,
    doesOrgHaveMoreThanOneOwner: true,
  };
  const rows = rowsFor(
    [
      membership("me", "owner"),
      membership("peer", "owner"),
      membership("amy", "member"),
      membership("gone", "member", { isActive: false }),
    ],
    [invite("leo")]
  );

  test("an owner may change, remove and reactivate others", () => {
    expect(getMemberRowAccess({ ...base, row: byId(rows, "amy") })).toMatchObject({
      canRemove: true,
      assignableRoles: ["member", "manager", "owner"],
      canReactivate: false,
    });
    expect(getMemberRowAccess({ ...base, row: byId(rows, "gone") }).canReactivate).toBe(true);
  });

  test("nobody removes themselves, and an owner's own row offers nothing to an owner", () => {
    const access = getMemberRowAccess({ ...base, row: byId(rows, "me") });

    expect(access).toMatchObject({ canRemove: false, assignableRoles: [], canLeave: false });
  });

  test("the last active owner cannot be removed or demoted", () => {
    const access = getMemberRowAccess({
      ...base,
      row: byId(rows, "peer"),
      doesOrgHaveMoreThanOneOwner: false,
    });

    expect(access.canRemove).toBe(false);
    expect(access.assignableRoles).toEqual([]);
  });

  test("a manager never touches an owner and only hands out the member role", () => {
    const manager = { ...base, currentRole: "manager" as const };

    expect(getMemberRowAccess({ ...manager, row: byId(rows, "peer") })).toMatchObject({
      canRemove: false,
      assignableRoles: [],
    });
    expect(getMemberRowAccess({ ...manager, row: byId(rows, "amy") }).assignableRoles).toEqual(["member"]);
  });

  test("changing a role needs the access-control licence, removing does not", () => {
    const access = getMemberRowAccess({ ...base, canEditRoles: false, row: byId(rows, "amy") });

    expect(access.assignableRoles).toEqual([]);
    expect(access.canRemove).toBe(true);
  });

  test("invites can be resent, shared and deleted by user managers only", () => {
    expect(getMemberRowAccess({ ...base, row: byId(rows, "leo") })).toMatchObject({
      canResend: true,
      canShareLink: true,
      canRemove: true,
    });
    expect(getMemberRowAccess({ ...base, canManageUsers: false, row: byId(rows, "leo") })).toMatchObject({
      canResend: false,
      canShareLink: false,
      canRemove: false,
    });
  });

  test("a non-owner may leave their own row only with multi-organization on and another organization", () => {
    const self = { ...base, currentUserId: "amy", currentRole: "member" as const, canManageUsers: false };

    expect(getMemberRowAccess({ ...self, row: byId(rows, "amy") }).canLeave).toBe(true);
    expect(getMemberRowAccess({ ...self, isMultiOrgEnabled: false, row: byId(rows, "amy") }).canLeave).toBe(
      false
    );
    expect(
      getMemberRowAccess({ ...self, hasOtherOrganizations: false, row: byId(rows, "amy") }).canLeave
    ).toBe(false);
  });
});

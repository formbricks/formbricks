import { describe, expect, test } from "vitest";
import {
  type TInviteInput,
  type TMemberRow,
  type TMembershipInput,
  buildMemberRows,
  getMemberRowActions,
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

describe("getMemberRowActions", () => {
  const base = {
    currentUserId: "me",
    currentRole: "owner" as const,
    canManageUsers: true,
    isMultiOrgEnabled: true,
    hasOtherOrganizations: true,
  };
  const rows = rowsFor([membership("me", "owner"), membership("amy", "member")], [invite("leo")]);

  test("a user manager may copy an invite link, and only an invite's", () => {
    expect(getMemberRowActions({ ...base, row: byId(rows, "leo") }).canShareLink).toBe(true);
    expect(getMemberRowActions({ ...base, row: byId(rows, "amy") }).canShareLink).toBe(false);
    expect(getMemberRowActions({ ...base, canManageUsers: false, row: byId(rows, "leo") }).canShareLink).toBe(
      false
    );
  });

  test("an owner never leaves, whatever the instance allows", () => {
    expect(getMemberRowActions({ ...base, row: byId(rows, "me") }).canLeave).toBe(false);
  });

  test("a non-owner may leave their own row only with multi-organization on and another organization", () => {
    const self = { ...base, currentUserId: "amy", currentRole: "member" as const, canManageUsers: false };

    expect(getMemberRowActions({ ...self, row: byId(rows, "amy") }).canLeave).toBe(true);
    expect(getMemberRowActions({ ...self, isMultiOrgEnabled: false, row: byId(rows, "amy") }).canLeave).toBe(
      false
    );
    expect(
      getMemberRowActions({ ...self, hasOtherOrganizations: false, row: byId(rows, "amy") }).canLeave
    ).toBe(false);
  });

  test("nobody leaves on someone else's row", () => {
    expect(getMemberRowActions({ ...base, currentRole: "manager", row: byId(rows, "amy") }).canLeave).toBe(
      false
    );
  });
});

describe("buildMemberRows without sensitive fields", () => {
  test("rows built from a query that left out two-factor state and teams carry neither", () => {
    const rows = buildMemberRows({
      memberships: [
        { userId: "amy", role: "member", user: { name: "amy", email: "amy@acme.com", isActive: true } },
      ],
      invites: [
        {
          id: "inv",
          email: "inv@acme.com",
          name: null,
          role: "member",
          createdAt: new Date("2026-06-08T12:00:00Z"),
          expiresAt: new Date("2026-06-15T12:00:00Z"),
        },
      ],
      teamNameById: new Map([["t1", "Product"]]),
      now: NOW,
    });

    expect(rows.map(({ twoFactorEnabled, teamNames }) => ({ twoFactorEnabled, teamNames }))).toEqual([
      { twoFactorEnabled: null, teamNames: [] },
      { twoFactorEnabled: null, teamNames: [] },
    ]);
  });
});

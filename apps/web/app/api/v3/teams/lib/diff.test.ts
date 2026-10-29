import { describe, expect, test } from "vitest";
import { type TTeamState, diffTeam, hasTeamChanges, lowersTeamAccess } from "./diff";

const base: TTeamState = {
  name: "Support",
  members: [
    { userId: "u1", role: "admin" },
    { userId: "u2", role: "contributor" },
  ],
  workspaces: [
    { workspaceId: "w1", permission: "manage" },
    { workspaceId: "w2", permission: "read" },
  ],
};

describe("diffTeam", () => {
  test("an identical team has no changes", () => {
    const changes = diffTeam(base, structuredClone(base));

    expect(hasTeamChanges(changes)).toBe(false);
    expect(lowersTeamAccess(changes)).toBe(false);
  });

  test("lists what was added, removed and re-scoped, as ids", () => {
    const changes = diffTeam(base, {
      name: "Success",
      members: [
        { userId: "u2", role: "admin" },
        { userId: "u3", role: "contributor" },
      ],
      workspaces: [
        { workspaceId: "w2", permission: "readWrite" },
        { workspaceId: "w3", permission: "read" },
      ],
    });

    expect(changes).toEqual({
      name: { from: "Support", to: "Success" },
      membersAdded: ["u3"],
      membersRemoved: ["u1"],
      memberRolesChanged: [{ userId: "u2", from: "contributor", to: "admin" }],
      workspacesAdded: ["w3"],
      workspacesRemoved: ["w1"],
      workspacePermissionsChanged: [{ workspaceId: "w2", from: "read", to: "readWrite" }],
    });
  });
});

describe("lowersTeamAccess", () => {
  const change = (next: Partial<TTeamState>) => lowersTeamAccess(diffTeam(base, { ...base, ...next }));

  test("adding people, widening access and renaming take nothing away", () => {
    expect(change({ name: "Other" })).toBe(false);
    expect(change({ members: [...base.members, { userId: "u3", role: "contributor" }] })).toBe(false);
    expect(
      change({
        members: [
          { userId: "u1", role: "admin" },
          { userId: "u2", role: "admin" },
        ],
      })
    ).toBe(false);
    expect(
      change({
        workspaces: [
          { workspaceId: "w1", permission: "manage" },
          { workspaceId: "w2", permission: "readWrite" },
          { workspaceId: "w3", permission: "manage" },
        ],
      })
    ).toBe(false);
  });

  test.each([
    ["a member removed", { members: [base.members[0]] }],
    [
      "an admin demoted",
      {
        members: [
          { userId: "u1", role: "contributor" as const },
          { userId: "u2", role: "contributor" as const },
        ],
      },
    ],
    ["a workspace removed", { workspaces: [base.workspaces[0]] }],
    [
      "a permission lowered",
      {
        workspaces: [
          { workspaceId: "w1", permission: "readWrite" as const },
          { workspaceId: "w2", permission: "read" as const },
        ],
      },
    ],
  ])("%s takes access away", (_label, next) => {
    expect(change(next)).toBe(true);
  });

  test("everyone removed is a removal even from an empty-looking list", () => {
    expect(change({ members: [], workspaces: [] })).toBe(true);
  });
});

import { describe, expect, test } from "vitest";
import { TMember } from "@formbricks/types/memberships";
import { TInvite } from "@/modules/organization/settings/teams/types/invites";
import { hasMoreThanOneActiveOwner, isInviteExpired } from "./utils";

describe("isInviteExpired", () => {
  test("returns true if invite is expired", () => {
    const invite: TInvite = {
      id: "1",
      email: "test@example.com",
      name: "Test",
      role: "member",
      expiresAt: new Date(Date.now() - 1000 * 60 * 60),
      createdAt: new Date(),
    };
    expect(isInviteExpired(invite)).toBe(true);
  });

  test("returns false if invite is not expired", () => {
    const invite: TInvite = {
      id: "1",
      email: "test@example.com",
      name: "Test",
      role: "member",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      createdAt: new Date(),
    };
    expect(isInviteExpired(invite)).toBe(false);
  });
});

describe("hasMoreThanOneActiveOwner", () => {
  const member = (overrides: Partial<TMember>): TMember => ({
    name: "Test",
    email: "test@example.com",
    userId: "user-1",
    accepted: true,
    role: "owner",
    isActive: true,
    ...overrides,
  });

  test("returns true for two active owners", () => {
    expect(hasMoreThanOneActiveOwner([member({ userId: "user-1" }), member({ userId: "user-2" })])).toBe(
      true
    );
  });

  test("returns false for a single active owner", () => {
    expect(hasMoreThanOneActiveOwner([member({}), member({ userId: "user-2", role: "manager" })])).toBe(
      false
    );
  });

  // The server's `getOrganizationOwnerCount` excludes deactivated users because they can never sign in
  // again, so the sole active owner is still the last owner the guards protect.
  test("does not count a deactivated owner", () => {
    expect(hasMoreThanOneActiveOwner([member({}), member({ userId: "user-2", isActive: false })])).toBe(
      false
    );
  });

  test("counts an owner membership regardless of accepted, matching the server", () => {
    expect(hasMoreThanOneActiveOwner([member({}), member({ userId: "user-2", accepted: false })])).toBe(true);
  });

  test("returns false for an organization with no owners", () => {
    expect(hasMoreThanOneActiveOwner([member({ role: "member" }), member({ role: "manager" })])).toBe(false);
  });
});

import { describe, expect, test } from "vitest";
import { canActOnInvite, showDeleteButton } from "./member-controls";

const invite = (role: "owner" | "member") =>
  ({
    id: "invite-1",
    email: "i@example.test",
    name: "I",
    role,
    expiresAt: new Date(),
    createdAt: new Date(),
  }) as never;
const member = (role: "owner" | "manager" | "member", isActive = true, userId = "user-2") =>
  ({ userId, name: "M", email: "m@example.test", role, accepted: true, isActive }) as never;

const as = (overrides: Partial<{ canManageUsers: boolean; isManager: boolean; more: boolean }> = {}) => ({
  canManageUsers: overrides.canManageUsers ?? true,
  isManager: overrides.isManager ?? false,
  currentUserId: "user-1",
  doesOrgHaveMoreThanOneOwner: overrides.more ?? false,
});

// The controls must not look enabled where the server refuses (ENG-6812).
describe("member row controls", () => {
  test("nothing below the user-management floor", () => {
    expect(showDeleteButton(invite("member"), as({ canManageUsers: false }))).toBe(false);
    expect(showDeleteButton(member("member"), as({ canManageUsers: false }))).toBe(false);
    expect(canActOnInvite(invite("member"), { canManageUsers: false, isManager: false })).toBe(false);
  });

  test("a manager never acts on an owner's invite, but does on anyone else's", () => {
    expect(canActOnInvite(invite("owner"), { canManageUsers: true, isManager: true })).toBe(false);
    expect(showDeleteButton(invite("owner"), as({ isManager: true }))).toBe(false);
    expect(canActOnInvite(invite("member"), { canManageUsers: true, isManager: true })).toBe(true);
    expect(canActOnInvite(invite("owner"), { canManageUsers: true, isManager: false })).toBe(true);
  });

  test("an owner may remove a deactivated owner while the only active owner stays", () => {
    expect(showDeleteButton(member("owner", false), as())).toBe(true);
    expect(showDeleteButton(member("owner", true), as())).toBe(false);
    expect(showDeleteButton(member("owner", true), as({ more: true }))).toBe(true);
  });
});

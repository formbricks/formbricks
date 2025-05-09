import { TInvite } from "@/modules/organization/settings/teams/types/invites";
import { describe, expect, test } from "vitest";
import { isInviteExpired } from "./utils";

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

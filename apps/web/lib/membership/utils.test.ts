import { describe, expect, test } from "vitest";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { getAccessFlags } from "./utils";

describe("getAccessFlags", () => {
  test("should return correct flags for owner role", () => {
    const role: TOrganizationRole = "owner";
    const flags = getAccessFlags(role);
    expect(flags).toEqual({
      isManager: false,
      isOwner: true,
      isBilling: false,
      isMember: false,
    });
  });

  test("should return correct flags for manager role", () => {
    const role: TOrganizationRole = "manager";
    const flags = getAccessFlags(role);
    expect(flags).toEqual({
      isManager: true,
      isOwner: false,
      isBilling: false,
      isMember: false,
    });
  });

  test("should return correct flags for billing role", () => {
    const role: TOrganizationRole = "billing";
    const flags = getAccessFlags(role);
    expect(flags).toEqual({
      isManager: false,
      isOwner: false,
      isBilling: true,
      isMember: false,
    });
  });

  test("should return correct flags for member role", () => {
    const role: TOrganizationRole = "member";
    const flags = getAccessFlags(role);
    expect(flags).toEqual({
      isManager: false,
      isOwner: false,
      isBilling: false,
      isMember: true,
    });
  });

  test("should return all flags as false when role is undefined", () => {
    const flags = getAccessFlags(undefined);
    expect(flags).toEqual({
      isManager: false,
      isOwner: false,
      isBilling: false,
      isMember: false,
    });
  });
});

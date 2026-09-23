import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { type TOrganizationRole, ZOrganizationRole } from "@formbricks/types/memberships";
import enUS from "@/locales/en-US.json";
import { getAccessFlags, getOrganizationRoleLabels } from "./utils";

const lookup = (key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], enUS);

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

describe("getOrganizationRoleLabels", () => {
  /** Echoing the key back makes an unresolved key visible instead of silently rendering blank. */
  const echo = ((key: string) => key) as unknown as TFunction;

  test("covers every role in the enum", () => {
    expect(Object.keys(getOrganizationRoleLabels(echo)).sort()).toEqual(
      [...ZOrganizationRole.options].sort()
    );
  });

  test("every key it resolves exists in en-US", () => {
    for (const key of Object.values(getOrganizationRoleLabels(echo))) {
      expect(lookup(key)).toBeTypeOf("string");
    }
  });

  test("renders the English labels", () => {
    const labels = getOrganizationRoleLabels(((key: string) => lookup(key)) as unknown as TFunction);
    expect(labels).toEqual({
      owner: "Owner",
      manager: "Manager",
      member: "Member",
      billing: "Billing",
    });
  });
});

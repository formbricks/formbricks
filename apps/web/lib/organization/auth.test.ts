import { beforeEach, describe, expect, test, vi } from "vitest";
import { can } from "../authorization";
import { validateInputs } from "../utils/validate";
import { canUserAccessOrganization, verifyUserRoleAccess } from "./auth";

vi.mock("../authorization", () => ({
  can: vi.fn(),
}));

vi.mock("../utils/validate", () => ({
  validateInputs: vi.fn(),
}));

describe("organization authorization helpers", () => {
  const userId = "user1";
  const organizationId = "org1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("canUserAccessOrganization delegates to organization.read", async () => {
    vi.mocked(can).mockResolvedValue(true);

    await expect(canUserAccessOrganization(userId, organizationId)).resolves.toBe(true);

    expect(validateInputs).toHaveBeenCalledWith(
      [userId, expect.anything()],
      [organizationId, expect.anything()]
    );
    expect(can).toHaveBeenCalledWith({ type: "user", id: userId }, "organization.read", {
      type: "organization",
      id: organizationId,
    });
  });

  test.each([
    {
      name: "owner",
      owner: true,
      manager: true,
      expected: {
        hasCreateOrUpdateAccess: true,
        hasDeleteAccess: true,
        hasCreateOrUpdateMembersAccess: true,
        hasDeleteMembersAccess: true,
        hasBillingAccess: true,
      },
    },
    {
      name: "manager",
      owner: false,
      manager: true,
      expected: {
        hasCreateOrUpdateAccess: false,
        hasDeleteAccess: false,
        hasCreateOrUpdateMembersAccess: true,
        hasDeleteMembersAccess: true,
        hasBillingAccess: true,
      },
    },
    {
      name: "member",
      owner: false,
      manager: false,
      expected: {
        hasCreateOrUpdateAccess: false,
        hasDeleteAccess: false,
        hasCreateOrUpdateMembersAccess: false,
        hasDeleteMembersAccess: false,
        hasBillingAccess: false,
      },
    },
  ])("preserves the $name role access bundle", async ({ owner, manager, expected }) => {
    vi.mocked(can).mockResolvedValueOnce(owner).mockResolvedValueOnce(manager);

    await expect(verifyUserRoleAccess(organizationId, userId)).resolves.toEqual(expected);

    expect(can).toHaveBeenNthCalledWith(1, { type: "user", id: userId }, "organization.write", {
      type: "organization",
      id: organizationId,
    });
    expect(can).toHaveBeenNthCalledWith(2, { type: "user", id: userId }, "organization.manage", {
      type: "organization",
      id: organizationId,
    });
  });

  test("propagates evaluator failures", async () => {
    vi.mocked(can).mockRejectedValue(new Error("database unavailable"));

    await expect(verifyUserRoleAccess(organizationId, userId)).rejects.toThrow("database unavailable");
  });
});
